import { supabase } from "../../../lib/supabase/client";

export type TourismGuest = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  guest_count: number;
  preferences: string | null;
  special_requests: string | null;
  status: "active" | "vip" | "watchlist" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TourismBooking = {
  id: string;
  organization_id: string;
  guest_id: string | null;
  booking_reference: string | null;
  activity_name: string;
  booking_date: string;
  pickup_time: string | null;
  pickup_location: string | null;
  guest_count: number;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded";
  notes: string | null;
  assigned_guide_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  guest?: Pick<TourismGuest, "id" | "full_name" | "phone" | "email"> | null;
};

export type TourismItineraryItem = {
  id: string;
  organization_id: string;
  booking_id: string | null;
  guest_id: string | null;
  title: string;
  item_type: "arrival" | "transfer" | "activity" | "meal" | "accommodation" | "departure" | "note";
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  status: "planned" | "confirmed" | "in_progress" | "done" | "cancelled";
  notes: string | null;
  assigned_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  guest?: Pick<TourismGuest, "id" | "full_name"> | null;
};

export type TourismTransfer = {
  id: string;
  organization_id: string;
  booking_id: string | null;
  guest_id: string | null;
  transfer_type: "pickup" | "dropoff" | "activity_transfer" | "airport" | "border" | "custom";
  pickup_location: string;
  dropoff_location: string;
  scheduled_at: string;
  status: "scheduled" | "dispatched" | "picked_up" | "completed" | "cancelled";
  driver_id: string | null;
  vehicle_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  guest?: Pick<TourismGuest, "id" | "full_name" | "phone"> | null;
};

export type TourismDashboardData = {
  guests: TourismGuest[];
  bookings: TourismBooking[];
  itineraries: TourismItineraryItem[];
  transfers: TourismTransfer[];
};

export type CreateTourismGuestInput = {
  organizationId: string;
  fullName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  guestCount?: number;
  preferences?: string;
  specialRequests?: string;
  status?: TourismGuest["status"];
  createdBy?: string | null;
};

export type CreateTourismBookingInput = {
  organizationId: string;
  guestId?: string | null;
  bookingReference?: string;
  activityName: string;
  bookingDate: string;
  pickupTime?: string;
  pickupLocation?: string;
  guestCount?: number;
  status?: TourismBooking["status"];
  paymentStatus?: TourismBooking["payment_status"];
  notes?: string;
  assignedGuideId?: string | null;
  createdBy?: string | null;
};

export type CreateTourismItineraryInput = {
  organizationId: string;
  bookingId?: string | null;
  guestId?: string | null;
  title: string;
  itemType?: TourismItineraryItem["item_type"];
  startsAt: string;
  endsAt?: string;
  location?: string;
  status?: TourismItineraryItem["status"];
  notes?: string;
  assignedUserId?: string | null;
  createdBy?: string | null;
};

export type CreateTourismTransferInput = {
  organizationId: string;
  bookingId?: string | null;
  guestId?: string | null;
  transferType?: TourismTransfer["transfer_type"];
  pickupLocation: string;
  dropoffLocation: string;
  scheduledAt: string;
  status?: TourismTransfer["status"];
  driverId?: string | null;
  vehicleId?: string | null;
  notes?: string;
  createdBy?: string | null;
};

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function getTourismDashboardData(
  organizationId: string,
): Promise<TourismDashboardData> {
  const [guests, bookings, itineraries, transfers] = await Promise.all([
    supabase
      .from("tourism_guests")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tourism_bookings")
      .select("*, guest:tourism_guests(id, full_name, phone, email)")
      .eq("organization_id", organizationId)
      .order("booking_date", { ascending: false })
      .limit(50),
    supabase
      .from("tourism_itinerary_items")
      .select("*, guest:tourism_guests(id, full_name)")
      .eq("organization_id", organizationId)
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase
      .from("tourism_transfers")
      .select("*, guest:tourism_guests(id, full_name, phone)")
      .eq("organization_id", organizationId)
      .order("scheduled_at", { ascending: true })
      .limit(50),
  ]);

  if (guests.error) throw guests.error;
  if (bookings.error) throw bookings.error;
  if (itineraries.error) throw itineraries.error;
  if (transfers.error) throw transfers.error;

  return {
    guests: (guests.data ?? []) as TourismGuest[],
    bookings: (bookings.data ?? []) as TourismBooking[],
    itineraries: (itineraries.data ?? []) as TourismItineraryItem[],
    transfers: (transfers.data ?? []) as TourismTransfer[],
  };
}

export async function createTourismGuest(
  input: CreateTourismGuestInput,
): Promise<TourismGuest> {
  const { data, error } = await supabase
    .from("tourism_guests")
    .insert({
      organization_id: input.organizationId,
      full_name: input.fullName.trim(),
      email: cleanText(input.email),
      phone: cleanText(input.phone),
      nationality: cleanText(input.nationality),
      guest_count: input.guestCount ?? 1,
      preferences: cleanText(input.preferences),
      special_requests: cleanText(input.specialRequests),
      status: input.status ?? "active",
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as TourismGuest;
}

export async function createTourismBooking(
  input: CreateTourismBookingInput,
): Promise<TourismBooking> {
  const { data, error } = await supabase
    .from("tourism_bookings")
    .insert({
      organization_id: input.organizationId,
      guest_id: input.guestId ?? null,
      booking_reference: cleanText(input.bookingReference),
      activity_name: input.activityName.trim(),
      booking_date: input.bookingDate,
      pickup_time: cleanText(input.pickupTime),
      pickup_location: cleanText(input.pickupLocation),
      guest_count: input.guestCount ?? 1,
      status: input.status ?? "pending",
      payment_status: input.paymentStatus ?? "unpaid",
      notes: cleanText(input.notes),
      assigned_guide_id: input.assignedGuideId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*, guest:tourism_guests(id, full_name, phone, email)")
    .single();

  if (error) throw error;
  return data as TourismBooking;
}

export async function createTourismItineraryItem(
  input: CreateTourismItineraryInput,
): Promise<TourismItineraryItem> {
  const { data, error } = await supabase
    .from("tourism_itinerary_items")
    .insert({
      organization_id: input.organizationId,
      booking_id: input.bookingId ?? null,
      guest_id: input.guestId ?? null,
      title: input.title.trim(),
      item_type: input.itemType ?? "activity",
      starts_at: input.startsAt,
      ends_at: cleanText(input.endsAt),
      location: cleanText(input.location),
      status: input.status ?? "planned",
      notes: cleanText(input.notes),
      assigned_user_id: input.assignedUserId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*, guest:tourism_guests(id, full_name)")
    .single();

  if (error) throw error;
  return data as TourismItineraryItem;
}

export async function createTourismTransfer(
  input: CreateTourismTransferInput,
): Promise<TourismTransfer> {
  const { data, error } = await supabase
    .from("tourism_transfers")
    .insert({
      organization_id: input.organizationId,
      booking_id: input.bookingId ?? null,
      guest_id: input.guestId ?? null,
      transfer_type: input.transferType ?? "pickup",
      pickup_location: input.pickupLocation.trim(),
      dropoff_location: input.dropoffLocation.trim(),
      scheduled_at: input.scheduledAt,
      status: input.status ?? "scheduled",
      driver_id: input.driverId ?? null,
      vehicle_id: input.vehicleId ?? null,
      notes: cleanText(input.notes),
      created_by: input.createdBy ?? null,
    })
    .select("*, guest:tourism_guests(id, full_name, phone)")
    .single();

  if (error) throw error;
  return data as TourismTransfer;
}
