import { supabase } from "../../../lib/supabase/client";
import { createNotification } from "../../../lib/supabase/mutations/notifications";

const DEFAULT_SERVICE_INTERVAL_KM = 10000;

export type FleetServiceStatus =
  | "service_overdue"
  | "service_soon"
  | "service_ok";

export type FleetVehicle = {
  id: string;
  organization_id?: string;
  office_id?: string | null;
  vehicle_name: string | null;
  registration_number: string | null;
  current_odometer_km: number | null;
  last_service_date?: string | null;
  last_service_odometer_km?: number | null;
  next_service_date?: string | null;
  next_service_odometer_km?: number | null;
  service_interval_km?: number | null;
  service_status?: FleetServiceStatus | string | null;
  estimated_days_to_service?: number | null;
  latest_odometer_at?: string | null;
  status: string | null;
  created_at?: string | null;
  office?: { id: string; name: string; slug: string | null } | null;
};

export type FleetDailySummary = {
  id: string;
  organization_id: string;
  vehicle_id: string;
  summary_date: string;
  route_length_km: number;
  move_duration_seconds: number;
  stop_duration_seconds: number;
  stop_count: number;
  fuel_consumption_litres: number | null;
  fuel_cost: number | null;
  currency: string;
  odometer_km: number | null;
  driver_name: string | null;
  imported_at: string;
  created_at: string;
  vehicle?: FleetVehicle | null;
};

export type FleetServiceSchedule = {
  id: string;
  organization_id: string;
  vehicle_id: string;
  schedule_name: string;
  service_type: string;
  interval_km: number | null;
  interval_months: number | null;
  last_service_date: string | null;
  last_service_odometer_km: number | null;
  next_service_date: string | null;
  next_service_odometer_km: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  vehicle?: FleetVehicle | null;
};

export type FleetMaintenanceRecord = {
  id: string;
  organization_id: string;
  vehicle_id: string;
  service_date: string;
  odometer_km: number | null;
  service_type: string;
  description: string | null;
  provider: string | null;
  cost: number | null;
  currency: string;
  invoice_url: string | null;
  next_service_date: string | null;
  next_service_odometer_km: number | null;
  created_by: string | null;
  created_at: string;
  vehicle?: FleetVehicle | null;
};

export type FleetImportBatchStatus =
  | "processing"
  | "completed"
  | "partial_failed"
  | "failed";

export type FleetImportBatch = {
  id: string;
  organization_id: string;
  source: string;
  import_type: string;
  file_name: string | null;
  status: FleetImportBatchStatus;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
};

export type FleetImportRowStatus =
  | "pending"
  | "imported"
  | "failed"
  | "unmatched";

export type FleetImportRow = {
  id: string;
  organization_id: string;
  batch_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  mapped_data: Record<string, unknown>;
  vehicle_id: string | null;
  status: FleetImportRowStatus;
  error_message: string | null;
  created_at: string;
  vehicle?: FleetVehicle | null;
};

export type FleetFuelPurchase = {
  id: string;
  organization_id: string;
  vehicle_id: string;
  purchase_date: string;
  litres: number;
  unit_price: number | null;
  total_cost: number;
  currency: string;
  odometer_km: number | null;
  station_name: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  receipt_url: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: FleetVehicle | null;
};

export type CreateFuelPurchaseInput = {
  organizationId: string;
  vehicleId: string;
  purchaseDate: string;
  litres: number;
  totalCost: number;
  currency: string;
  unitPrice?: number | null;
  odometerKm?: number | null;
  stationName?: string | null;
  paymentMethod?: string | null;
  receiptNumber?: string | null;
  receiptUrl?: string | null;
  recordedBy?: string | null;
  notes?: string | null;
};

export type CreateMaintenanceRecordInput = {
  organizationId: string;
  vehicleId: string;
  serviceDate: string;
  odometerKm?: number | null;
  serviceType: string;
  notes?: string | null;
  provider?: string | null;
  cost?: number | null;
  currency?: string | null;
  receiptUrl?: string | null;
  nextServiceDate?: string | null;
  nextServiceOdometerKm?: number | null;
  createdBy?: string | null;
};

export type FleetDashboardData = {
  vehicles: FleetVehicle[];
  summaries: FleetDailySummary[];
  batches: FleetImportBatch[];
  rows: FleetImportRow[];
  fuelPurchases: FleetFuelPurchase[];
  serviceSchedules: FleetServiceSchedule[];
  maintenanceRecords: FleetMaintenanceRecord[];
};

export type FleetDashboardDateRange =
  | { mode: "fixed"; startDate: string; endDate: string }
  | { mode: "latest-import-day" };

export type FleetServiceResolution = {
  vehicle: FleetVehicle;
  currentOdometerKm: number | null;
  currentOdometerSource: "ezitrack" | "vehicle" | "none";
  currentOdometerDate: string | null;
  nextServiceOdometerKm: number | null;
  nextServiceOdometerSource:
    | "vehicle"
    | "schedule"
    | "vehicle_interval"
    | "default_interval"
    | "none";
  serviceIntervalKm: number;
  averageDailyKm: number | null;
  remainingKm: number | null;
  estimatedDaysToService: number | null;
  estimatedNextServiceDate: string | null;
  serviceStatus: FleetServiceStatus;
  serviceMessage: string;
  odometerWarning: string | null;
  estimateWarning: string | null;
};

const VEHICLE_SELECT = `
  id,
  organization_id,
  office_id,
  vehicle_name,
  registration_number,
  current_odometer_km,
  last_service_date,
  last_service_odometer_km,
  next_service_date,
  next_service_odometer_km,
  service_interval_km,
  service_status,
  estimated_days_to_service,
  latest_odometer_at,
  status,
  created_at,
  office:company_offices(id, name, slug)
`;

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Math.ceil(days));
  return toDateKey(date);
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function normalizeVehicle(row: Record<string, unknown>): FleetVehicle {
  const office = row.office as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    organization_id: row.organization_id ? String(row.organization_id) : undefined,
    office_id: (row.office_id as string | null) ?? null,
    vehicle_name: (row.vehicle_name as string | null) ?? null,
    registration_number: (row.registration_number as string | null) ?? null,
    current_odometer_km: optionalNumber(row.current_odometer_km),
    last_service_date: (row.last_service_date as string | null) ?? null,
    last_service_odometer_km: optionalNumber(row.last_service_odometer_km),
    next_service_date: (row.next_service_date as string | null) ?? null,
    next_service_odometer_km: optionalNumber(row.next_service_odometer_km),
    service_interval_km: optionalNumber(row.service_interval_km),
    service_status: (row.service_status as string | null) ?? null,
    estimated_days_to_service: optionalNumber(row.estimated_days_to_service),
    latest_odometer_at: (row.latest_odometer_at as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    office: office
      ? {
          id: String(office.id),
          name: String(office.name),
          slug: (office.slug as string | null) ?? null,
        }
      : null,
  };
}

function normalizeDailySummary(row: Record<string, unknown>): FleetDailySummary {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    summary_date: String(row.summary_date),
    route_length_km: asNumber(row.route_length_km),
    move_duration_seconds: asNumber(row.move_duration_seconds),
    stop_duration_seconds: asNumber(row.stop_duration_seconds),
    stop_count: asNumber(row.stop_count),
    fuel_consumption_litres: optionalNumber(row.fuel_consumption_litres),
    fuel_cost: optionalNumber(row.fuel_cost),
    currency: String(row.currency ?? "USD"),
    odometer_km: optionalNumber(row.odometer_km),
    driver_name: (row.driver_name as string | null) ?? null,
    imported_at: String(row.imported_at ?? row.created_at ?? ""),
    created_at: String(row.created_at ?? ""),
    vehicle: row.vehicle ? normalizeVehicle(row.vehicle as Record<string, unknown>) : null,
  };
}

function normalizeSchedule(row: Record<string, unknown>): FleetServiceSchedule {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    schedule_name: String(row.schedule_name ?? "Routine service"),
    service_type: String(row.service_type ?? "service"),
    interval_km: optionalNumber(row.interval_km),
    interval_months: optionalNumber(row.interval_months),
    last_service_date: (row.last_service_date as string | null) ?? null,
    last_service_odometer_km: optionalNumber(row.last_service_odometer_km),
    next_service_date: (row.next_service_date as string | null) ?? null,
    next_service_odometer_km: optionalNumber(row.next_service_odometer_km),
    status: String(row.status ?? "active"),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    vehicle: row.vehicle ? normalizeVehicle(row.vehicle as Record<string, unknown>) : null,
  };
}

function normalizeMaintenance(row: Record<string, unknown>): FleetMaintenanceRecord {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    service_date: String(row.service_date),
    odometer_km: optionalNumber(row.odometer_km),
    service_type: String(row.service_type ?? "service"),
    description: (row.description as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    cost: optionalNumber(row.cost),
    currency: String(row.currency ?? "USD"),
    invoice_url: (row.invoice_url as string | null) ?? null,
    next_service_date: (row.next_service_date as string | null) ?? null,
    next_service_odometer_km: optionalNumber(row.next_service_odometer_km),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    vehicle: row.vehicle ? normalizeVehicle(row.vehicle as Record<string, unknown>) : null,
  };
}

function normalizeFuel(row: Record<string, unknown>): FleetFuelPurchase {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    purchase_date: String(row.purchase_date),
    litres: asNumber(row.litres),
    unit_price: optionalNumber(row.unit_price),
    total_cost: asNumber(row.total_cost),
    currency: String(row.currency ?? "USD"),
    odometer_km: optionalNumber(row.odometer_km),
    station_name: (row.station_name as string | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    receipt_number: (row.receipt_number as string | null) ?? null,
    receipt_url: (row.receipt_url as string | null) ?? null,
    recorded_by: (row.recorded_by as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    vehicle: row.vehicle ? normalizeVehicle(row.vehicle as Record<string, unknown>) : null,
  };
}

function calculateServiceStatus(params: {
  remainingKm: number | null;
  estimatedDaysToService: number | null;
}): { status: FleetServiceStatus; message: string } {
  if (params.remainingKm !== null && params.remainingKm <= 0) {
    return { status: "service_overdue", message: "Service overdue" };
  }
  if (
    (params.remainingKm !== null && params.remainingKm <= 1000) ||
    (params.estimatedDaysToService !== null &&
      params.estimatedDaysToService >= 0 &&
      params.estimatedDaysToService <= 14)
  ) {
    return {
      status: "service_soon",
      message:
        params.estimatedDaysToService !== null &&
        params.estimatedDaysToService <= 14
          ? "Service likely due within 14 days"
          : "Service needed soon",
    };
  }
  return { status: "service_ok", message: "Service OK" };
}

function calculateAverageDailyKm(readings: Array<{ summary_date: string; odometer_km: number | null }>) {
  const sorted = readings
    .filter((reading) => reading.odometer_km !== null)
    .map((reading) => ({
      date: reading.summary_date.slice(0, 10),
      odometer: Number(reading.odometer_km),
    }))
    .filter((reading) => Number.isFinite(reading.odometer))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) return null;

  const oldest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const distance = latest.odometer - oldest.odometer;
  const days = daysBetween(oldest.date, latest.date);

  if (!Number.isFinite(distance) || distance <= 0 || days <= 0) return null;
  return Number((distance / days).toFixed(2));
}

async function getVehicleOrThrow(organizationId: string, vehicleId: string) {
  const { data, error } = await supabase
    .from("fleet_vehicles")
    .select(VEHICLE_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", vehicleId)
    .single();
  if (error) throw new Error(error.message || "Vehicle not found.");
  return normalizeVehicle(data as Record<string, unknown>);
}

async function getOdometerReadings(organizationId: string, vehicleId: string, limit = 90) {
  const { data, error } = await supabase
    .from("fleet_daily_summaries")
    .select("summary_date, odometer_km")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .not("odometer_km", "is", null)
    .order("summary_date", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message || "Failed to load EziTrack odometer readings.");

  return (data ?? []).map((row) => ({
    summary_date: String(row.summary_date),
    odometer_km: optionalNumber(row.odometer_km),
  }));
}

async function getActiveServiceSchedules(organizationId: string, vehicleId: string) {
  const { data, error } = await supabase
    .from("fleet_service_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .eq("status", "active")
    .order("next_service_odometer_km", { ascending: true, nullsFirst: false })
    .order("next_service_date", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message || "Failed to load service schedules.");
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeSchedule);
}

export async function resolveVehicleServiceDefaults(params: {
  organizationId: string;
  vehicleId: string;
  serviceDate: string;
}): Promise<FleetServiceResolution> {
  const [vehicle, readings, schedules] = await Promise.all([
    getVehicleOrThrow(params.organizationId, params.vehicleId),
    getOdometerReadings(params.organizationId, params.vehicleId),
    getActiveServiceSchedules(params.organizationId, params.vehicleId),
  ]);

  const latestReading = readings[readings.length - 1] ?? null;
  const currentOdometerKm =
    latestReading?.odometer_km ?? vehicle.current_odometer_km ?? null;
  const currentOdometerSource = latestReading?.odometer_km !== null && latestReading?.odometer_km !== undefined
    ? "ezitrack"
    : vehicle.current_odometer_km !== null && vehicle.current_odometer_km !== undefined
      ? "vehicle"
      : "none";

  const serviceIntervalKm =
    vehicle.service_interval_km && vehicle.service_interval_km > 0
      ? vehicle.service_interval_km
      : DEFAULT_SERVICE_INTERVAL_KM;

  const scheduleNextOdo = schedules.find(
    (schedule) => schedule.next_service_odometer_km !== null,
  )?.next_service_odometer_km ?? null;

  let nextServiceOdometerKm = vehicle.next_service_odometer_km ?? null;
  let nextServiceOdometerSource: FleetServiceResolution["nextServiceOdometerSource"] = "vehicle";

  if (nextServiceOdometerKm === null && scheduleNextOdo !== null) {
    nextServiceOdometerKm = scheduleNextOdo;
    nextServiceOdometerSource = "schedule";
  } else if (nextServiceOdometerKm === null && currentOdometerKm !== null) {
    nextServiceOdometerKm = currentOdometerKm + serviceIntervalKm;
    nextServiceOdometerSource =
      vehicle.service_interval_km && vehicle.service_interval_km > 0
        ? "vehicle_interval"
        : "default_interval";
  }

  if (nextServiceOdometerKm === null) {
    nextServiceOdometerSource = "none";
  }

  const averageDailyKm = calculateAverageDailyKm(readings);
  const remainingKm =
    currentOdometerKm !== null && nextServiceOdometerKm !== null
      ? nextServiceOdometerKm - currentOdometerKm
      : null;
  const estimatedDaysToService =
    remainingKm !== null && remainingKm <= 0
      ? 0
      : remainingKm !== null && averageDailyKm && averageDailyKm > 0
        ? Number((remainingKm / averageDailyKm).toFixed(2))
        : null;
  const estimatedNextServiceDate =
    estimatedDaysToService !== null && estimatedDaysToService > 0
      ? addDays(params.serviceDate, estimatedDaysToService)
      : null;
  const status = calculateServiceStatus({ remainingKm, estimatedDaysToService });

  return {
    vehicle,
    currentOdometerKm,
    currentOdometerSource,
    currentOdometerDate: latestReading?.summary_date ?? vehicle.latest_odometer_at ?? null,
    nextServiceOdometerKm,
    nextServiceOdometerSource,
    serviceIntervalKm,
    averageDailyKm,
    remainingKm,
    estimatedDaysToService,
    estimatedNextServiceDate,
    serviceStatus: status.status,
    serviceMessage: status.message,
    odometerWarning:
      currentOdometerKm === null
        ? "No current odometer found. Import EziTrack data first or update vehicle odometer."
        : null,
    estimateWarning:
      averageDailyKm === null
        ? "Not enough EziTrack movement data to estimate date."
        : null,
  };
}

async function resolveDateRange(organizationId: string, range: FleetDashboardDateRange) {
  if (range.mode === "fixed") return { startDate: range.startDate, endDate: range.endDate };
  const { data, error } = await supabase
    .from("fleet_daily_summaries")
    .select("summary_date")
    .eq("organization_id", organizationId)
    .order("summary_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const latest = String(data?.summary_date ?? toDateKey(new Date()));
  return { startDate: latest, endDate: latest };
}

export async function fetchFleetDashboardData(
  organizationId: string,
  dateRange: FleetDashboardDateRange,
): Promise<FleetDashboardData> {
  const range = await resolveDateRange(organizationId, dateRange);
  const [
    vehiclesResult,
    summariesResult,
    batchesResult,
    fuelResult,
    schedulesResult,
    maintenanceResult,
  ] = await Promise.all([
    supabase
      .from("fleet_vehicles")
      .select(VEHICLE_SELECT)
      .eq("organization_id", organizationId)
      .order("vehicle_name", { ascending: true }),
    supabase
      .from("fleet_daily_summaries")
      .select(`*, vehicle:fleet_vehicles(${VEHICLE_SELECT})`)
      .eq("organization_id", organizationId)
      .gte("summary_date", range.startDate)
      .lte("summary_date", range.endDate)
      .order("summary_date", { ascending: false }),
    supabase
      .from("fleet_import_batches")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("fleet_fuel_purchases")
      .select(`*, vehicle:fleet_vehicles(${VEHICLE_SELECT})`)
      .eq("organization_id", organizationId)
      .order("purchase_date", { ascending: false })
      .limit(120),
    supabase
      .from("fleet_service_schedules")
      .select(`*, vehicle:fleet_vehicles(${VEHICLE_SELECT})`)
      .eq("organization_id", organizationId)
      .order("next_service_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("fleet_maintenance_records")
      .select(
        `id, organization_id, vehicle_id, service_date, odometer_km, service_type, description, provider, cost, currency, invoice_url, next_service_date, next_service_odometer_km, created_by, created_at, vehicle:fleet_vehicles(${VEHICLE_SELECT})`,
      )
      .eq("organization_id", organizationId)
      .order("service_date", { ascending: false })
      .limit(120),
  ]);

  if (vehiclesResult.error) throw new Error(vehiclesResult.error.message);
  if (summariesResult.error) throw new Error(summariesResult.error.message);
  if (batchesResult.error) throw new Error(batchesResult.error.message);
  if (fuelResult.error) throw new Error(fuelResult.error.message);
  if (schedulesResult.error) throw new Error(schedulesResult.error.message);
  if (maintenanceResult.error) throw new Error(maintenanceResult.error.message);

  const batches = (batchesResult.data ?? []) as FleetImportBatch[];
  const batchIds = batches.map((batch) => batch.id);
  let rows: FleetImportRow[] = [];

  if (batchIds.length > 0) {
    const rowsResult = await supabase
      .from("fleet_import_rows")
      .select(`*, vehicle:fleet_vehicles(${VEHICLE_SELECT})`)
      .in("batch_id", batchIds)
      .order("created_at", { ascending: false })
      .limit(120);
    if (rowsResult.error) throw new Error(rowsResult.error.message);
    rows = (rowsResult.data ?? []) as FleetImportRow[];
  }

  return {
    vehicles: ((vehiclesResult.data ?? []) as Record<string, unknown>[]).map(normalizeVehicle),
    summaries: ((summariesResult.data ?? []) as Record<string, unknown>[]).map(normalizeDailySummary),
    batches,
    rows,
    fuelPurchases: ((fuelResult.data ?? []) as Record<string, unknown>[]).map(normalizeFuel),
    serviceSchedules: ((schedulesResult.data ?? []) as Record<string, unknown>[]).map(normalizeSchedule),
    maintenanceRecords: ((maintenanceResult.data ?? []) as Record<string, unknown>[]).map(normalizeMaintenance),
  };
}

export async function createFuelPurchase(input: CreateFuelPurchaseInput) {
  const unitPrice =
    input.unitPrice ??
    (input.litres > 0 ? Number((input.totalCost / input.litres).toFixed(4)) : null);
  const { data, error } = await supabase
    .from("fleet_fuel_purchases")
    .insert({
      organization_id: input.organizationId,
      vehicle_id: input.vehicleId,
      purchase_date: input.purchaseDate,
      litres: input.litres,
      unit_price: unitPrice,
      total_cost: input.totalCost,
      currency: input.currency || "USD",
      odometer_km: input.odometerKm ?? null,
      station_name: input.stationName?.trim() || null,
      payment_method: input.paymentMethod?.trim() || null,
      receipt_number: input.receiptNumber?.trim() || null,
      receipt_url: input.receiptUrl?.trim() || null,
      recorded_by: input.recordedBy ?? null,
      notes: input.notes?.trim() || null,
    })
    .select(`*, vehicle:fleet_vehicles(${VEHICLE_SELECT})`)
    .single();

  if (error) throw new Error(error.message || "Failed to record fuel purchase.");
  if (input.odometerKm !== null && input.odometerKm !== undefined) {
    await updateVehicleOdometerFromReading({
      organizationId: input.organizationId,
      vehicleId: input.vehicleId,
      odometerKm: input.odometerKm,
      readingAt: input.purchaseDate,
    });
  }
  return normalizeFuel(data as Record<string, unknown>);
}

export async function createMaintenanceRecord(input: CreateMaintenanceRecordInput) {
  const resolved = await resolveVehicleServiceDefaults({
    organizationId: input.organizationId,
    vehicleId: input.vehicleId,
    serviceDate: input.serviceDate,
  });

  const resolvedCurrentOdo = input.odometerKm ?? resolved.currentOdometerKm;
  if (resolvedCurrentOdo === null || resolvedCurrentOdo === undefined) {
    throw new Error("No current odometer found. Import EziTrack data first or update vehicle odometer.");
  }

  const resolvedNextOdo = input.nextServiceOdometerKm ?? resolved.nextServiceOdometerKm;
  if (resolvedNextOdo === null || resolvedNextOdo === undefined) {
    throw new Error("Next service odometer could not be resolved.");
  }

  const remainingKm = resolvedNextOdo - resolvedCurrentOdo;
  const averageDailyKm = resolved.averageDailyKm;
  const estimatedDaysToService =
    remainingKm <= 0
      ? 0
      : averageDailyKm && averageDailyKm > 0
        ? Number((remainingKm / averageDailyKm).toFixed(2))
        : null;
  const resolvedNextDate =
    input.nextServiceDate ||
    (estimatedDaysToService !== null && estimatedDaysToService > 0
      ? addDays(input.serviceDate, estimatedDaysToService)
      : null);
  const status = calculateServiceStatus({ remainingKm, estimatedDaysToService });

  const { data, error } = await supabase
    .from("fleet_maintenance_records")
    .insert({
      organization_id: input.organizationId,
      vehicle_id: input.vehicleId,
      service_date: input.serviceDate,
      odometer_km: resolvedCurrentOdo,
      service_type: input.serviceType.trim() || "Routine service",
      description: input.notes?.trim() || null,
      provider: input.provider?.trim() || null,
      cost: input.cost ?? null,
      currency: input.currency?.trim() || "USD",
      invoice_url: input.receiptUrl?.trim() || null,
      next_service_date: resolvedNextDate,
      next_service_odometer_km: resolvedNextOdo,
      created_by: input.createdBy ?? null,
    })
    .select(`id, organization_id, vehicle_id, service_date, odometer_km, service_type, description, provider, cost, currency, invoice_url, next_service_date, next_service_odometer_km, created_by, created_at, vehicle:fleet_vehicles(${VEHICLE_SELECT})`)
    .single();

  if (error) throw new Error(error.message || "Failed to record service history.");

  const { error: vehicleError } = await supabase
    .from("fleet_vehicles")
    .update({
      current_odometer_km: resolvedCurrentOdo,
      last_service_date: input.serviceDate,
      last_service_odometer_km: resolvedCurrentOdo,
      next_service_date: resolvedNextDate,
      next_service_odometer_km: resolvedNextOdo,
      service_status: status.status,
      estimated_days_to_service: estimatedDaysToService,
      latest_odometer_at: resolved.currentOdometerDate || new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.vehicleId);

  if (vehicleError) throw new Error(vehicleError.message || "Service saved, but vehicle update failed.");
  return normalizeMaintenance(data as Record<string, unknown>);
}

export async function updateVehicleOdometerFromReading(params: {
  organizationId: string;
  vehicleId: string;
  odometerKm: number;
  readingAt?: string | null;
}) {
  const resolved = await resolveVehicleServiceDefaults({
    organizationId: params.organizationId,
    vehicleId: params.vehicleId,
    serviceDate: toDateKey(new Date()),
  });
  const nextServiceOdo = resolved.nextServiceOdometerKm;
  const remainingKm = nextServiceOdo === null ? null : nextServiceOdo - params.odometerKm;
  const estimatedDaysToService =
    remainingKm !== null && remainingKm <= 0
      ? 0
      : remainingKm !== null && resolved.averageDailyKm
        ? Number((remainingKm / resolved.averageDailyKm).toFixed(2))
        : null;
  const status = calculateServiceStatus({ remainingKm, estimatedDaysToService });

  const { error } = await supabase
    .from("fleet_vehicles")
    .update({
      current_odometer_km: params.odometerKm,
      service_status: status.status,
      estimated_days_to_service: estimatedDaysToService,
      latest_odometer_at: params.readingAt || new Date().toISOString(),
    })
    .eq("organization_id", params.organizationId)
    .eq("id", params.vehicleId);
  if (error) throw new Error(error.message);

  return { serviceStatus: status.status, remainingKm, estimatedDaysToService };
}

export async function notifyFleetServiceStatus(params: {
  organizationId: string;
  vehicleId: string;
  vehicleLabel: string;
  status: "overdue" | "soon";
  remainingKm: number;
  nextServiceOdo?: number | null;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", params.organizationId)
    .in("primary_role", ["admin", "manager", "it", "superadmin", "it-superadmin"]);

  if (error) throw error;
  const recipients = (data ?? []).map((row) => row.id as string);
  return Promise.allSettled(
    recipients.map((userId) =>
      createNotification({
        organizationId: params.organizationId,
        userId,
        type: "system_alert",
        title: params.status === "overdue" ? "Vehicle service overdue" : "Vehicle service due soon",
        message:
          params.status === "overdue"
            ? `${params.vehicleLabel} has passed its next service odometer.`
            : `${params.vehicleLabel} is close to its next service. ${Math.max(0, Math.round(params.remainingKm))} km remaining.`,
        entityType: "fleet_vehicle",
        entityId: params.vehicleId,
        actionUrl: "/fleet",
        priority: params.status === "overdue" ? "high" : "medium",
        category: "fleet",
        dedupeKey: `fleet-service:${params.status}:${params.vehicleId}`,
        metadata: {
          module: "fleet",
          vehicleId: params.vehicleId,
          serviceStatus: params.status,
          remainingKm: params.remainingKm,
          nextServiceOdo: params.nextServiceOdo ?? null,
        },
      }),
    ),
  );
}
