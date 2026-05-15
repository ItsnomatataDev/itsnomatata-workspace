import { supabase } from "../../../lib/supabase/client";
import { createNotification } from "../../../lib/supabase/mutations/notifications";

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
  service_status?: string | null;
  estimated_days_to_service?: number | null;
  latest_odometer_at?: string | null;
  status: string | null;
  created_at?: string | null;
  office?: {
    id: string;
    name: string;
    slug: string | null;
  } | null;
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

export type FleetDailySummary = {
  id: string;
  organization_id: string;
  vehicle_id: string;
  summary_date: string;
  source: string;
  period_start: string | null;
  period_end: string | null;
  route_start: string | null;
  route_end: string | null;
  route_length_km: number;
  move_duration_seconds: number;
  stop_duration_seconds: number;
  stop_count: number;
  top_speed_kmh: number | null;
  average_speed_kmh: number | null;
  overspeed_count: number;
  fuel_consumption_litres: number | null;
  average_fuel_consumption_per_100km: number | null;
  fuel_cost: number | null;
  currency: string;
  engine_work_seconds: number;
  engine_idle_seconds: number;
  odometer_km: number | null;
  engine_hours_seconds: number;
  driver_name: string | null;
  imported_at: string;
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
  | {
      mode: "fixed";
      startDate: string;
      endDate: string;
    }
  | {
      mode: "latest-import-day";
    };

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVehicle(row: Record<string, unknown>): FleetVehicle {
  const office = row.office as Record<string, unknown> | null | undefined;

  return {
    id: String(row.id),
    organization_id: row.organization_id
      ? String(row.organization_id)
      : undefined,
    office_id: (row.office_id as string | null) ?? null,
    vehicle_name: (row.vehicle_name as string | null) ?? null,
    registration_number: (row.registration_number as string | null) ?? null,
    current_odometer_km:
      row.current_odometer_km === null || row.current_odometer_km === undefined
        ? null
        : asNumber(row.current_odometer_km),
    last_service_date: (row.last_service_date as string | null) ?? null,
    last_service_odometer_km:
      row.last_service_odometer_km === null ||
      row.last_service_odometer_km === undefined
        ? null
        : asNumber(row.last_service_odometer_km),
    next_service_date: (row.next_service_date as string | null) ?? null,
    next_service_odometer_km:
      row.next_service_odometer_km === null ||
      row.next_service_odometer_km === undefined
        ? null
        : asNumber(row.next_service_odometer_km),
    service_interval_km:
      row.service_interval_km === null || row.service_interval_km === undefined
        ? null
        : asNumber(row.service_interval_km),
    service_status: (row.service_status as string | null) ?? null,
    estimated_days_to_service:
      row.estimated_days_to_service === null ||
      row.estimated_days_to_service === undefined
        ? null
        : asNumber(row.estimated_days_to_service),
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

function normalizeDailySummary(
  row: Record<string, unknown>,
): FleetDailySummary {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    summary_date: String(row.summary_date),
    source: String(row.source ?? "ezitrack_email"),
    period_start: (row.period_start as string | null) ?? null,
    period_end: (row.period_end as string | null) ?? null,
    route_start: (row.route_start as string | null) ?? null,
    route_end: (row.route_end as string | null) ?? null,
    route_length_km: asNumber(row.route_length_km),
    move_duration_seconds: asNumber(row.move_duration_seconds),
    stop_duration_seconds: asNumber(row.stop_duration_seconds),
    stop_count: asNumber(row.stop_count),
    top_speed_kmh:
      row.top_speed_kmh === null || row.top_speed_kmh === undefined
        ? null
        : asNumber(row.top_speed_kmh),
    average_speed_kmh:
      row.average_speed_kmh === null || row.average_speed_kmh === undefined
        ? null
        : asNumber(row.average_speed_kmh),
    overspeed_count: asNumber(row.overspeed_count),
    fuel_consumption_litres:
      row.fuel_consumption_litres === null ||
      row.fuel_consumption_litres === undefined
        ? null
        : asNumber(row.fuel_consumption_litres),
    average_fuel_consumption_per_100km:
      row.average_fuel_consumption_per_100km === null ||
      row.average_fuel_consumption_per_100km === undefined
        ? null
        : asNumber(row.average_fuel_consumption_per_100km),
    fuel_cost:
      row.fuel_cost === null || row.fuel_cost === undefined
        ? null
        : asNumber(row.fuel_cost),
    currency: String(row.currency ?? "USD"),
    engine_work_seconds: asNumber(row.engine_work_seconds),
    engine_idle_seconds: asNumber(row.engine_idle_seconds),
    odometer_km:
      row.odometer_km === null || row.odometer_km === undefined
        ? null
        : asNumber(row.odometer_km),
    engine_hours_seconds: asNumber(row.engine_hours_seconds),
    driver_name: (row.driver_name as string | null) ?? null,
    imported_at: String(row.imported_at),
    created_at: String(row.created_at),
    vehicle: row.vehicle
      ? normalizeVehicle(row.vehicle as Record<string, unknown>)
      : null,
  };
}

function normalizeFuelPurchase(
  row: Record<string, unknown>,
): FleetFuelPurchase {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    purchase_date: String(row.purchase_date),
    litres: asNumber(row.litres),
    unit_price:
      row.unit_price === null || row.unit_price === undefined
        ? null
        : asNumber(row.unit_price),
    total_cost: asNumber(row.total_cost),
    currency: String(row.currency ?? "USD"),
    odometer_km:
      row.odometer_km === null || row.odometer_km === undefined
        ? null
        : asNumber(row.odometer_km),
    station_name: (row.station_name as string | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    receipt_number: (row.receipt_number as string | null) ?? null,
    receipt_url: (row.receipt_url as string | null) ?? null,
    recorded_by: (row.recorded_by as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    vehicle: row.vehicle
      ? normalizeVehicle(row.vehicle as Record<string, unknown>)
      : null,
  };
}

function normalizeServiceSchedule(
  row: Record<string, unknown>,
): FleetServiceSchedule {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    schedule_name: String(row.schedule_name ?? "Service"),
    service_type: String(row.service_type ?? "Service"),
    interval_km:
      row.interval_km === null || row.interval_km === undefined
        ? null
        : asNumber(row.interval_km),
    interval_months:
      row.interval_months === null || row.interval_months === undefined
        ? null
        : asNumber(row.interval_months),
    last_service_date: (row.last_service_date as string | null) ?? null,
    last_service_odometer_km:
      row.last_service_odometer_km === null ||
      row.last_service_odometer_km === undefined
        ? null
        : asNumber(row.last_service_odometer_km),
    next_service_date: (row.next_service_date as string | null) ?? null,
    next_service_odometer_km:
      row.next_service_odometer_km === null ||
      row.next_service_odometer_km === undefined
        ? null
        : asNumber(row.next_service_odometer_km),
    status: String(row.status ?? "active"),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    vehicle: row.vehicle
      ? normalizeVehicle(row.vehicle as Record<string, unknown>)
      : null,
  };
}

function normalizeMaintenanceRecord(
  row: Record<string, unknown>,
): FleetMaintenanceRecord {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    service_date: String(row.service_date),
    odometer_km:
      row.odometer_km === null || row.odometer_km === undefined
        ? null
        : asNumber(row.odometer_km),
    service_type: String(row.service_type ?? "Service"),
    description: (row.description as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    cost:
      row.cost === null || row.cost === undefined ? null : asNumber(row.cost),
    currency: String(row.currency ?? "USD"),
    invoice_url: (row.invoice_url as string | null) ?? null,
    next_service_date: (row.next_service_date as string | null) ?? null,
    next_service_odometer_km:
      row.next_service_odometer_km === null ||
      row.next_service_odometer_km === undefined
        ? null
        : asNumber(row.next_service_odometer_km),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    vehicle: row.vehicle
      ? normalizeVehicle(row.vehicle as Record<string, unknown>)
      : null,
  };
}

async function resolveFleetDashboardDateRange(
  organizationId: string,
  dateRange: FleetDashboardDateRange,
) {
  if (dateRange.mode === "fixed") {
    return {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };
  }

  const { data, error } = await supabase
    .from("fleet_daily_summaries")
    .select("summary_date")
    .eq("organization_id", organizationId)
    .order("summary_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load latest fleet import day.");
  }

  const latestImportDay = String(data?.summary_date ?? "");

  return {
    startDate: latestImportDay,
    endDate: latestImportDay,
  };
}

export async function fetchFleetDashboardData(
  organizationId: string,
  dateRange: FleetDashboardDateRange,
): Promise<FleetDashboardData> {
  const resolvedDateRange = await resolveFleetDashboardDateRange(
    organizationId,
    dateRange,
  );

  const vehicleSelect = `
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

  const [
    vehiclesResult,
    summariesResult,
    batchesResult,
    fuelPurchasesResult,
    serviceSchedulesResult,
    maintenanceRecordsResult,
  ] = await Promise.all([
    supabase
      .from("fleet_vehicles")
      .select(vehicleSelect)
      .eq("organization_id", organizationId)
      .order("vehicle_name", { ascending: true }),

    supabase
      .from("fleet_daily_summaries")
      .select(
        `
        *,
        vehicle:fleet_vehicles(
          id,
          organization_id,
          office_id,
          vehicle_name,
          registration_number,
          current_odometer_km,
          status
        )
      `,
      )
      .eq("organization_id", organizationId)
      .gte("summary_date", resolvedDateRange.startDate)
      .lte("summary_date", resolvedDateRange.endDate)
      .order("summary_date", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("fleet_import_batches")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("fleet_fuel_purchases")
      .select(
        `
        *,
        vehicle:fleet_vehicles(
          id,
          organization_id,
          office_id,
          vehicle_name,
          registration_number,
          current_odometer_km,
          status
        )
      `,
      )
      .eq("organization_id", organizationId)
      .order("purchase_date", { ascending: false })
      .limit(120),

    supabase
      .from("fleet_service_schedules")
      .select(
        `
        *,
        vehicle:fleet_vehicles(${vehicleSelect})
      `,
      )
      .eq("organization_id", organizationId)
      .order("next_service_date", { ascending: true, nullsFirst: false })
      .order("next_service_odometer_km", {
        ascending: true,
        nullsFirst: false,
      }),

    supabase
      .from("fleet_maintenance_records")
      .select(
        `
        id,
        organization_id,
        vehicle_id,
        service_date,
        odometer_km,
        service_type,
        description,
        provider,
        cost,
        currency,
        invoice_url,
        next_service_date,
        next_service_odometer_km,
        created_by,
        created_at,
        vehicle:fleet_vehicles(${vehicleSelect})
      `,
      )
      .eq("organization_id", organizationId)
      .order("service_date", { ascending: false })
      .limit(120),
  ]);

  if (vehiclesResult.error) throw new Error(vehiclesResult.error.message);
  if (summariesResult.error) throw new Error(summariesResult.error.message);
  if (batchesResult.error) throw new Error(batchesResult.error.message);
  if (fuelPurchasesResult.error) {
    throw new Error(fuelPurchasesResult.error.message);
  }
  if (serviceSchedulesResult.error) {
    throw new Error(serviceSchedulesResult.error.message);
  }
  if (maintenanceRecordsResult.error) {
    throw new Error(maintenanceRecordsResult.error.message);
  }

  const batches = (batchesResult.data ?? []) as FleetImportBatch[];
  const batchIds = batches.map((batch) => batch.id);
  let rows: FleetImportRow[] = [];

  if (batchIds.length > 0) {
    const rowsResult = await supabase
      .from("fleet_import_rows")
      .select(
        `
        *,
        vehicle:fleet_vehicles(
          id,
          organization_id,
          office_id,
          vehicle_name,
          registration_number,
          current_odometer_km,
          status
        )
      `,
      )
      .in("batch_id", batchIds)
      .order("created_at", { ascending: false })
      .order("row_number", { ascending: true })
      .limit(120);

    if (rowsResult.error) throw new Error(rowsResult.error.message);
    rows = (rowsResult.data ?? []) as FleetImportRow[];
  }

  return {
    vehicles: ((vehiclesResult.data ?? []) as Record<string, unknown>[]).map(
      normalizeVehicle,
    ),
    summaries: ((summariesResult.data ?? []) as Record<string, unknown>[]).map(
      normalizeDailySummary,
    ),
    batches,
    rows,
    fuelPurchases: (
      (fuelPurchasesResult.data ?? []) as Record<string, unknown>[]
    ).map(normalizeFuelPurchase),
    serviceSchedules: (
      (serviceSchedulesResult.data ?? []) as Record<string, unknown>[]
    ).map(normalizeServiceSchedule),
    maintenanceRecords: (
      (maintenanceRecordsResult.data ?? []) as Record<string, unknown>[]
    ).map(normalizeMaintenanceRecord),
  };
}

export async function createFuelPurchase(
  input: CreateFuelPurchaseInput,
): Promise<FleetFuelPurchase> {
  const unitPrice =
    input.unitPrice ??
    (input.litres > 0
      ? Number((input.totalCost / input.litres).toFixed(4))
      : null);

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
    .select(
      `
      *,
      vehicle:fleet_vehicles(
        id,
        organization_id,
        office_id,
        vehicle_name,
        registration_number,
        current_odometer_km,
        status
      )
    `,
    )
    .single();

  if (error) {
    throw new Error(error.message || "Failed to record fuel purchase.");
  }

  if (input.odometerKm !== null && input.odometerKm !== undefined) {
    await updateVehicleOdometerFromReading({
      organizationId: input.organizationId,
      vehicleId: input.vehicleId,
      odometerKm: input.odometerKm,
      readingAt: input.purchaseDate,
      source: "fuel_purchase",
    });
  }

  return normalizeFuelPurchase(data as Record<string, unknown>);
}

export async function createMaintenanceRecord(
  input: CreateMaintenanceRecordInput,
): Promise<FleetMaintenanceRecord> {
  if (input.odometerKm === null || input.odometerKm === undefined) {
    throw new Error("Current odometer is required.");
  }

  if (
    !Number.isFinite(Number(input.odometerKm)) ||
    Number(input.odometerKm) < 0
  ) {
    throw new Error("Enter a valid current odometer.");
  }

  const vehicleResult = await supabase
    .from("fleet_vehicles")
    .select("id, service_interval_km")
    .eq("id", input.vehicleId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (vehicleResult.error) {
    throw new Error(vehicleResult.error.message);
  }

  const serviceIntervalKm = Number(
    vehicleResult.data?.service_interval_km ?? 10000,
  );

  const resolvedNextServiceOdometerKm =
    input.nextServiceOdometerKm ?? Number(input.odometerKm) + serviceIntervalKm;

  if (
    !Number.isFinite(resolvedNextServiceOdometerKm) ||
    resolvedNextServiceOdometerKm <= Number(input.odometerKm)
  ) {
    throw new Error(
      "Next service odometer must be greater than current odometer.",
    );
  }

  const { data, error } = await supabase
    .from("fleet_maintenance_records")
    .insert({
      organization_id: input.organizationId,
      vehicle_id: input.vehicleId,
      service_date: input.serviceDate,
      odometer_km: input.odometerKm,
      service_type: input.serviceType.trim() || "Routine service",
      description: input.notes?.trim() || null,
      provider: input.provider?.trim() || null,
      cost: input.cost ?? null,
      currency: input.currency?.trim() || "USD",
      invoice_url: input.receiptUrl?.trim() || null,
      next_service_date: input.nextServiceDate || null,
      next_service_odometer_km: resolvedNextServiceOdometerKm,
      created_by: input.createdBy ?? null,
    })
    .select(
      `
      id,
      organization_id,
      vehicle_id,
      service_date,
      odometer_km,
      service_type,
      description,
      provider,
      cost,
      currency,
      invoice_url,
      next_service_date,
      next_service_odometer_km,
      created_by,
      created_at,
      vehicle:fleet_vehicles(
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
        created_at
      )
    `,
    )
    .single();

  if (error) {
    throw new Error(error.message || "Failed to record service history.");
  }

  const { error: vehicleError } = await supabase
    .from("fleet_vehicles")
    .update({
      current_odometer_km: input.odometerKm,
      last_service_date: input.serviceDate,
      last_service_odometer_km: input.odometerKm,
      next_service_date: input.nextServiceDate || null,
      next_service_odometer_km: resolvedNextServiceOdometerKm,
      service_status: "service_ok",
      estimated_days_to_service: null,
      latest_odometer_at: new Date().toISOString(),
    })
    .eq("id", input.vehicleId)
    .eq("organization_id", input.organizationId);

  if (vehicleError) {
    throw new Error(
      vehicleError.message ||
        "Service saved, but vehicle service fields failed.",
    );
  }

  return normalizeMaintenanceRecord(data as Record<string, unknown>);
}

export async function updateVehicleOdometerFromReading(params: {
  organizationId: string;
  vehicleId: string;
  odometerKm: number;
  readingAt?: string | null;
  source?: string;
}) {
  const { data: vehicle, error: vehicleError } = await supabase
    .from("fleet_vehicles")
    .select(
      "id, current_odometer_km, next_service_odometer_km, next_service_date",
    )
    .eq("id", params.vehicleId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (vehicleError) throw new Error(vehicleError.message);
  if (!vehicle) return null;

  const currentOdo = Number(params.odometerKm);
  const nextServiceOdo =
    vehicle.next_service_odometer_km === null ||
    vehicle.next_service_odometer_km === undefined
      ? null
      : Number(vehicle.next_service_odometer_km);

  const remainingKm =
    nextServiceOdo === null ? null : Number(nextServiceOdo) - currentOdo;

  const estimatedDaysToService = await estimateDaysToService({
    organizationId: params.organizationId,
    vehicleId: params.vehicleId,
    remainingKm,
  });

  const serviceStatus =
    remainingKm !== null && remainingKm <= 0
      ? "service_overdue"
      : remainingKm !== null &&
          (remainingKm <= 1000 ||
            (estimatedDaysToService !== null && estimatedDaysToService <= 14))
        ? "service_soon"
        : "service_ok";

  const { error: updateError } = await supabase
    .from("fleet_vehicles")
    .update({
      current_odometer_km: currentOdo,
      service_status: serviceStatus,
      estimated_days_to_service: estimatedDaysToService,
      latest_odometer_at: params.readingAt || new Date().toISOString(),
    })
    .eq("id", params.vehicleId)
    .eq("organization_id", params.organizationId);

  if (updateError) throw new Error(updateError.message);

  return {
    serviceStatus,
    remainingKm,
    estimatedDaysToService,
  };
}

async function estimateDaysToService(params: {
  organizationId: string;
  vehicleId: string;
  remainingKm: number | null;
}) {
  if (params.remainingKm === null || params.remainingKm <= 0) return 0;

  const { data, error } = await supabase
    .from("fleet_daily_summaries")
    .select("summary_date, odometer_km")
    .eq("organization_id", params.organizationId)
    .eq("vehicle_id", params.vehicleId)
    .not("odometer_km", "is", null)
    .order("summary_date", { ascending: false })
    .limit(14);

  if (error) throw new Error(error.message);

  const readings = (data ?? [])
    .map((item) => ({
      summaryDate: String(item.summary_date),
      odometerKm: Number(item.odometer_km),
    }))
    .filter((item) => Number.isFinite(item.odometerKm))
    .sort((a, b) => a.summaryDate.localeCompare(b.summaryDate));

  if (readings.length < 2) return null;

  const oldest = readings[0];
  const latest = readings[readings.length - 1];

  const oldestDate = new Date(`${oldest.summaryDate.slice(0, 10)}T00:00:00`);
  const latestDate = new Date(`${latest.summaryDate.slice(0, 10)}T00:00:00`);

  if (
    Number.isNaN(oldestDate.getTime()) ||
    Number.isNaN(latestDate.getTime())
  ) {
    return null;
  }

  const days = Math.max(
    1,
    Math.round(
      (latestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const distance = latest.odometerKm - oldest.odometerKm;
  const averageDailyKm = distance / days;

  if (!Number.isFinite(averageDailyKm) || averageDailyKm <= 0) return null;

  return Number((params.remainingKm / averageDailyKm).toFixed(2));
}

export async function notifyFleetServiceStatus(params: {
  organizationId: string;
  vehicleId: string;
  vehicleLabel: string;
  status: "overdue" | "soon";
  remainingKm: number;
  nextServiceOdo?: number | null;
}) {
  const { data: recipients, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", params.organizationId)
    .in("primary_role", [
      "admin",
      "manager",
      "it",
      "superadmin",
      "it-superadmin",
    ]);

  if (error) throw error;

  const userIds = (recipients ?? []).map((recipient) => recipient.id as string);
  if (userIds.length === 0) return [];

  const overdue = params.status === "overdue";

  return Promise.all(
    userIds.map((userId) =>
      createNotification({
        organizationId: params.organizationId,
        userId,
        type: "system_alert",
        title: overdue ? "Vehicle service overdue" : "Vehicle service due soon",
        message: overdue
          ? `${params.vehicleLabel} has passed its next service odometer.`
          : `${params.vehicleLabel} is close to its next service. ${Math.max(
              0,
              Math.round(params.remainingKm),
            )} km remaining.`,
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
