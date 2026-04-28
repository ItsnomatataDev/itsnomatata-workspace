import { supabase } from "../../../lib/supabase/client";
import {
  notifyAndEmailUsers,
} from "../../notifications/services/notificationService";
import type {
  Meeting,
  MeetingWithParticipants,
  MeetingParticipant,
  MeetingMessage,
  CreateMeetingInput,
} from "../types/meeting";

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function getMeetings(
  organizationId: string,
): Promise<MeetingWithParticipants[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(`
      *,
      participants:meeting_participants (
        id,
        meeting_id,
        user_id,
        role,
        joined_at,
        left_at,
        is_muted,
        is_camera_on,
        profile:profiles (
          id,
          full_name,
          email,
          last_seen_at
        )
      )
    `)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MeetingWithParticipants[];
}

export async function createMeeting(
  input: CreateMeetingInput,
): Promise<Meeting> {
  const roomCode = generateRoomCode();
  const scheduledStart = input.scheduled_start ?? null;
  const isScheduled = Boolean(scheduledStart);

  // — insert the meeting —
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      organization_id: input.organization_id,
      title: input.title,
      description: input.description ?? null,
      host_id: input.host_id,
      meeting_type: input.meeting_type,
      scheduled_start: scheduledStart ?? new Date().toISOString(),
      status: isScheduled ? "scheduled" : "live",
      started_at: isScheduled ? null : new Date().toISOString(),
      ended_at: null,
      room_code: roomCode,
    })
    .select("*")
    .single();

  if (error) throw error;

  // — add host as participant —
  const { error: participantError } = await supabase
    .from("meeting_participants")
    .insert({
      meeting_id: data.id,
      user_id: input.host_id,
      role: "host",
      joined_at: isScheduled ? null : new Date().toISOString(),
      left_at: null,
      is_muted: false,
      is_camera_on: input.meeting_type === "video",
    });

  if (participantError) throw participantError;

  try {
    const participantUserIds: string[] = (input.participant_ids ?? []).filter(
      (id) => id !== input.host_id,
    );

    if (participantUserIds.length > 0) {
      const { data: hostProfile, error: hostError } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", input.host_id)
        .maybeSingle();

      if (hostError) {
        console.error("FETCH HOST PROFILE FOR MEETING NOTIFICATION ERROR:", hostError);
      }

      const hostName = hostProfile?.full_name?.trim() || "A team member";

      const scheduledLabel = scheduledStart
        ? new Date(scheduledStart).toLocaleString("en-ZW", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "now";

      await notifyAndEmailUsers({
        organizationId: input.organization_id,
        userIds: participantUserIds,
        type: "meeting",
        title: `Meeting Scheduled: ${input.title}`,
        message: `${hostName} scheduled "${input.title}" for ${scheduledLabel}. Join when ready.`,
        actionUrl: `/meetings/${data.id}`,
        priority: "high",
        entityType: "meeting",
        entityId: data.id,
        referenceId: data.id,
        referenceType: "meeting",
        metadata: {
          meetingId: data.id,
          meetingTitle: input.title,
          meetingType: input.meeting_type,
          scheduledStart: scheduledStart ?? null,
          hostId: input.host_id,
          hostName,
          roomCode,
        },
      });
    }
  } catch (notificationError) {
    console.error("MEETING NOTIFICATION ERROR:", notificationError);
  }

  return data as Meeting;
}

export async function getMeetingById(
  meetingId: string,
): Promise<MeetingWithParticipants | null> {
  const { data, error } = await supabase
    .from("meetings")
    .select(`
      *,
      participants:meeting_participants (
        id,
        meeting_id,
        user_id,
        role,
        joined_at,
        left_at,
        is_muted,
        is_camera_on,
        profile:profiles (
          id,
          full_name,
          email,
          last_seen_at
        )
      )
    `)
    .eq("id", meetingId)
    .maybeSingle();

  if (error) throw error;
  return (data as MeetingWithParticipants | null) ?? null;
}

export async function joinMeeting(params: {
  meetingId: string;
  userId: string;
}) {
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, status, started_at, ended_at")
    .eq("id", params.meetingId)
    .maybeSingle();

  if (meetingError) throw meetingError;
  if (!meeting) throw new Error("Meeting not found.");

  if (meeting.status === "ended" || meeting.status === "cancelled") {
    throw new Error("This meeting has already ended.");
  }

  if (meeting.status === "scheduled") {
    const { error: startError } = await supabase
      .from("meetings")
      .update({
        status: "live",
        started_at: meeting.started_at ?? new Date().toISOString(),
      })
      .eq("id", params.meetingId)
      .eq("status", "scheduled");

    if (startError) throw startError;
  }

  const { data: existingParticipant, error: existingError } = await supabase
    .from("meeting_participants")
    .select("id, role")
    .eq("meeting_id", params.meetingId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existingError) throw existingError;

  const role = existingParticipant?.role === "host" ? "host" : "participant";

  const { error } = await supabase
    .from("meeting_participants")
    .upsert(
      {
        meeting_id: params.meetingId,
        user_id: params.userId,
        role,
        joined_at: new Date().toISOString(),
        left_at: null,
      },
      { onConflict: "meeting_id,user_id" },
    );

  if (error) throw error;

  // Notify other participants that someone joined
  try {
    const { data: meetingData } = await supabase
      .from("meetings")
      .select("id, title, organization_id")
      .eq("id", params.meetingId)
      .single();

    if (meetingData) {
      const { data: joinerProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", params.userId)
        .single();

      const { data: otherParticipants } = await supabase
        .from("meeting_participants")
        .select("user_id")
        .eq("meeting_id", params.meetingId)
        .neq("user_id", params.userId);

      const otherUserIds = otherParticipants?.map(p => p.user_id) || [];

      if (otherUserIds.length > 0 && joinerProfile) {
        const joinerName = joinerProfile.full_name?.trim() || joinerProfile.email?.trim() || "Someone";

        await notifyAndEmailUsers({
          organizationId: meetingData.organization_id,
          userIds: otherUserIds,
          type: "meeting",
          title: `${joinerName} joined the meeting`,
          message: `${joinerName} has joined "${meetingData.title}".`,
          actionUrl: `/meetings/${params.meetingId}`,
          priority: "medium",
          entityType: "meeting",
          entityId: params.meetingId,
          referenceId: params.meetingId,
          referenceType: "meeting",
          metadata: {
            meetingId: params.meetingId,
            meetingTitle: meetingData.title,
            joinerId: params.userId,
            joinerName,
          },
        });
      }
    }
  } catch (notificationError) {
    console.error("MEETING JOIN NOTIFICATION ERROR:", notificationError);
  }
}

export async function leaveMeeting(params: {
  meetingId: string;
  userId: string;
}) {
  const { error } = await supabase
    .from("meeting_participants")
    .update({
      left_at: new Date().toISOString(),
    })
    .eq("meeting_id", params.meetingId)
    .eq("user_id", params.userId);

  if (error) throw error;
}

export async function updateMeetingMediaState(params: {
  meetingId: string;
  userId: string;
  isMuted?: boolean;
  isCameraOn?: boolean;
}) {
  const payload: Partial<MeetingParticipant> = {};

  if (typeof params.isMuted === "boolean") payload.is_muted = params.isMuted;
  if (typeof params.isCameraOn === "boolean") {
    payload.is_camera_on = params.isCameraOn;
  }

  const { error } = await supabase
    .from("meeting_participants")
    .update(payload)
    .eq("meeting_id", params.meetingId)
    .eq("user_id", params.userId);

  if (error) throw error;
}

export async function startMeeting(meetingId: string) {
  const { error } = await supabase
    .from("meetings")
    .update({
      status: "live",
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .eq("id", meetingId);

  if (error) throw error;
}

export async function endMeeting(meetingId: string) {
  const endedAt = new Date().toISOString();

  const { error } = await supabase
    .from("meetings")
    .update({
      status: "ended",
      ended_at: endedAt,
    })
    .eq("id", meetingId);

  if (error) throw error;

  const { error: participantError } = await supabase
    .from("meeting_participants")
    .update({
      left_at: endedAt,
    })
    .eq("meeting_id", meetingId)
    .is("left_at", null);

  if (participantError) throw participantError;
}

export async function getMeetingMessages(
  meetingId: string,
): Promise<MeetingMessage[]> {
  const { data, error } = await supabase
    .from("meeting_messages")
    .select(`
      *,
      sender:profiles!meeting_messages_sender_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MeetingMessage[];
}

export async function sendMeetingMessage(params: {
  meetingId: string;
  senderId: string;
  body: string;
}) {
  const trimmed = params.body.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("meeting_messages")
    .insert({
      meeting_id: params.meetingId,
      sender_id: params.senderId,
      body: trimmed,
    })
    .select(`
      *,
      sender:profiles!meeting_messages_sender_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .single();

  if (error) throw error;
  return data as MeetingMessage;
}