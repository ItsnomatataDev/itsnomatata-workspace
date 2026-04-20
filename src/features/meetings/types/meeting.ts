export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";
export type MeetingType = "audio" | "video";

export type Meeting = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  host_id: string;
  status: MeetingStatus;
  meeting_type: MeetingType;
  room_code: string;
  scheduled_start: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingParticipantProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  last_seen_at?: string | null;
};

export type MeetingParticipant = {
  id: string;
  meeting_id: string;
  user_id: string;
  role: "host" | "participant";
  joined_at: string | null;
  left_at: string | null;
  is_muted: boolean;
  is_camera_on: boolean;
  profile?: MeetingParticipantProfile | null;
};

export type MeetingMessage = {
  id: string;
  meeting_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

export type CreateMeetingInput = {
  organization_id: string;
  title: string;
  description?: string | null;
  host_id: string;
  meeting_type: MeetingType;
  scheduled_start?: string | null;
  participant_ids?: string[]; 
};

export type MeetingWithParticipants = Meeting & {
  participants?: MeetingParticipant[];
};

export type RemoteParticipantStream = {
  userId: string;
  stream: MediaStream;
};

export type MeetingMediaState = {
  localStream: MediaStream | null;
  remoteStreams: RemoteParticipantStream[];
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  error: string;
};