import { supabase } from "../../../lib/supabase/client";

export type FleetVehicle = {
  id: string;
  vehicle_name: string | null;
  registration_number: string | null;
  current_odometer_km: number | null;
  status: string | null;
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
};

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDailySummary(row: Record<string, unknown>): FleetDailySummary {
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
    top_speed_kmh: row.top_speed_kmh === null ? null : asNumber(row.top_speed_kmh),
    average_speed_kmh:
      row.average_speed_kmh === null ? null : asNumber(row.average_speed_kmh),
    overspeed_count: asNumber(row.overspeed_count),
    fuel_consumption_litres:
      row.fuel_consumption_litres === null
        ? null
        : asNumber(row.fuel_consumption_litres),
    average_fuel_consumption_per_100km:
      row.average_fuel_consumption_per_100km === null
        ? null
        : asNumber(row.average_fuel_consumption_per_100km),
    fuel_cost: row.fuel_cost === null ? null : asNumber(row.fuel_cost),
    currency: String(row.currency ?? "USD"),
    engine_work_seconds: asNumber(row.engine_work_seconds),
    engine_idle_seconds: asNumber(row.engine_idle_seconds),
    odometer_km: row.odometer_km === null ? null : asNumber(row.odometer_km),
    engine_hours_seconds: asNumber(row.engine_hours_seconds),
    driver_name: (row.driver_name as string | null) ?? null,
    imported_at: String(row.imported_at),
    created_at: String(row.created_at),
    vehicle: (row.vehicle as FleetVehicle | null) ?? null,
  };
}

function normalizeFuelPurchase(row: Record<string, unknown>): FleetFuelPurchase {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    vehicle_id: String(row.vehicle_id),
    purchase_date: String(row.purchase_date),
    litres: asNumber(row.litres),
    unit_price: row.unit_price === null ? null : asNumber(row.unit_price),
    total_cost: asNumber(row.total_cost),
    currency: String(row.currency ?? "USD"),
    odometer_km: row.odometer_km === null ? null : asNumber(row.odometer_km),
    station_name: (row.station_name as string | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    receipt_number: (row.receipt_number as string | null) ?? null,
    receipt_url: (row.receipt_url as string | null) ?? null,
    recorded_by: (row.recorded_by as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    vehicle: (row.vehicle as FleetVehicle | null) ?? null,
  };
}

export async function fetchFleetDashboardData(
  organizationId: string,
): Promise<FleetDashboardData> {
  const [vehiclesResult, summariesResult, batchesResult, fuelPurchasesResult] =
    await Promise.all([
    supabase
      .from("fleet_vehicles")
      .select("id, vehicle_name, registration_number, current_odometer_km, status")
      .eq("organization_id", organizationId)
      .order("vehicle_name", { ascending: true }),
    supabase
      .from("fleet_daily_summaries")
      .select(
        `
        *,
        vehicle:fleet_vehicles(
          id,
          vehicle_name,
          registration_number,
          current_odometer_km,
          status
        )
      `,
      )
      .eq("organization_id", organizationId)
      .order("summary_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
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
  ]);

  if (vehiclesResult.error) {
    throw new Error(vehiclesResult.error.message || "Failed to load fleet vehicles.");
  }

  if (summariesResult.error) {
    throw new Error(summariesResult.error.message || "Failed to load fleet summaries.");
  }

  if (batchesResult.error) {
    throw new Error(batchesResult.error.message || "Failed to load fleet imports.");
  }

  if (fuelPurchasesResult.error) {
    throw new Error(
      fuelPurchasesResult.error.message || "Failed to load fuel purchases.",
    );
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

    if (rowsResult.error) {
      throw new Error(rowsResult.error.message || "Failed to load fleet import rows.");
    }

    rows = (rowsResult.data ?? []) as FleetImportRow[];
  }

  return {
    vehicles: (vehiclesResult.data ?? []) as FleetVehicle[],
    summaries: ((summariesResult.data ?? []) as Record<string, unknown>[]).map(
      normalizeDailySummary,
    ),
    batches,
    rows,
    fuelPurchases: (
      (fuelPurchasesResult.data ?? []) as Record<string, unknown>[]
    ).map(normalizeFuelPurchase),
  };
}

export async function createFuelPurchase(
  input: CreateFuelPurchaseInput,
): Promise<FleetFuelPurchase> {
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
    .select(
      `
      *,
      vehicle:fleet_vehicles(
        id,
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

  return normalizeFuelPurchase(data as Record<string, unknown>);
}
