import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EziTrackRecord = {
  object?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  routeStart?: string | null;
  routeEnd?: string | null;
  routeLengthKm?: number | string | null;
  moveDurationSeconds?: number | string | null;
  stopDurationSeconds?: number | string | null;
  stopCount?: number | string | null;
  topSpeedKmh?: number | string | null;
  averageSpeedKmh?: number | string | null;
  overspeedCount?: number | string | null;
  fuelConsumptionLitres?: number | string | null;
  averageFuelConsumptionPer100Km?: number | string | null;
  fuelCost?: number | string | null;
  currency?: string | null;
  engineWorkSeconds?: number | string | null;
  engineIdleSeconds?: number | string | null;
  odometerKm?: number | string | null;
  engineHoursSeconds?: number | string | null;
  driverName?: string | null;
  rawData?: Record<string, unknown>;
};

type ImportBody = {
  organizationId?: string;
  source?: string;
  fileName?: string | null;
  emailSubject?: string | null;
  emailFrom?: string | null;
  receivedAt?: string | null;
  records?: EziTrackRecord[];
};

type VehicleRow = {
  id: string;
  vehicle_name?: string | null;
  registration_number?: string | null;
  current_odometer_km?: number | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-import-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeMatch(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: unknown, fallback = 0) {
  const parsed = toNumber(value);
  return parsed === null ? fallback : Math.max(0, Math.round(parsed));
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /z$|[+-]\d\d:?\d\d$/i.test(normalized);
  const date = new Date(hasZone ? normalized : `${normalized}+02:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function summaryDateFor(record: EziTrackRecord, receivedAt?: string | null) {
  const source =
    toIso(record.periodStart) ??
    toIso(record.routeStart) ??
    toIso(receivedAt) ??
    new Date().toISOString();
  return source.slice(0, 10);
}

function getVehicleName(record: EziTrackRecord) {
  return normalizeText(record.object);
}

function mapDailySummary(
  organizationId: string,
  vehicleId: string,
  source: string,
  record: EziTrackRecord,
  receivedAt?: string | null,
) {
  return {
    organization_id: organizationId,
    vehicle_id: vehicleId,
    summary_date: summaryDateFor(record, receivedAt),
    source,
    period_start: toIso(record.periodStart),
    period_end: toIso(record.periodEnd),
    route_start: toIso(record.routeStart),
    route_end: toIso(record.routeEnd),
    route_length_km: toNumber(record.routeLengthKm) ?? 0,
    move_duration_seconds: toInteger(record.moveDurationSeconds),
    stop_duration_seconds: toInteger(record.stopDurationSeconds),
    stop_count: toInteger(record.stopCount),
    top_speed_kmh: toNumber(record.topSpeedKmh),
    average_speed_kmh: toNumber(record.averageSpeedKmh),
    overspeed_count: toInteger(record.overspeedCount),
    fuel_consumption_litres: toNumber(record.fuelConsumptionLitres),
    average_fuel_consumption_per_100km: toNumber(record.averageFuelConsumptionPer100Km),
    fuel_cost: toNumber(record.fuelCost),
    currency: normalizeText(record.currency) || "USD",
    engine_work_seconds: toInteger(record.engineWorkSeconds),
    engine_idle_seconds: toInteger(record.engineIdleSeconds),
    odometer_km: toNumber(record.odometerKm),
    engine_hours_seconds: toInteger(record.engineHoursSeconds),
    driver_name: normalizeText(record.driverName) || null,
    raw_data: record.rawData ?? record,
    imported_at: new Date().toISOString(),
  };
}

async function createNotification(
  supabase: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    importedRows: number;
    failedRows: number;
    batchId: string;
  },
) {
  const { data: admins, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("account_status", "active")
    .in("primary_role", ["admin", "manager", "it", "superadmin", "it-superadmin"]);

  if (error || !admins?.length) return;

  await supabase.from("notifications").insert(
    admins.map((admin) => ({
      organization_id: params.organizationId,
      user_id: admin.id,
      type: "system_alert",
      title: params.failedRows > 0
        ? "EziTrack import completed with issues"
        : "EziTrack import completed",
      message: `${params.importedRows} fleet row(s) imported, ${params.failedRows} failed.`,
      entity_type: "fleet_import_batch",
      entity_id: params.batchId,
      action_url: "/fleet/imports",
      priority: params.failedRows > 0 ? "high" : "medium",
      category: "fleet",
      metadata: {
        imported_rows: params.importedRows,
        failed_rows: params.failedRows,
        source: "ezitrack_email",
      },
      dedupe_key: `fleet-import:${params.batchId}:${admin.id}`,
    })),
  );
}

async function optionalInsertMileageLog(
  supabase: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    vehicleId: string;
    summaryDate: string;
    routeLengthKm: number;
    odometerKm: number | null;
    rawData: Record<string, unknown>;
  },
) {
  if (params.routeLengthKm <= 0) return;
  const { error } = await supabase.from("fleet_mileage_logs").insert({
    organization_id: params.organizationId,
    vehicle_id: params.vehicleId,
    log_date: params.summaryDate,
    distance_km: params.routeLengthKm,
    odometer_km: params.odometerKm,
    source: "ezitrack_email",
    metadata: params.rawData,
  });
  if (error) {
    console.warn("Skipped fleet_mileage_logs insert:", error?.message ?? error);
  }
}

async function optionalInsertFuelLog(
  supabase: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    vehicleId: string;
    summaryDate: string;
    litres: number | null;
    cost: number | null;
    currency: string;
    odometerKm: number | null;
    rawData: Record<string, unknown>;
  },
) {
  if (!params.litres || params.litres <= 0) return;
  const { error } = await supabase.from("fleet_fuel_logs").insert({
    organization_id: params.organizationId,
    vehicle_id: params.vehicleId,
    fuel_date: params.summaryDate,
    litres: params.litres,
    cost: params.cost,
    currency: params.currency,
    odometer_km: params.odometerKm,
    source: "ezitrack_email",
    metadata: params.rawData,
  });
  if (error) {
    console.warn("Skipped fleet_fuel_logs insert:", error?.message ?? error);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const expectedSecret = Deno.env.get("EZITRACK_IMPORT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !expectedSecret) {
      return jsonResponse({ error: "Import function is not configured." }, 500);
    }

    const importSecret = req.headers.get("x-import-secret") ?? "";
    if (importSecret !== expectedSecret) {
      return jsonResponse({ error: "Unauthorized import request." }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as ImportBody;
    const organizationId = normalizeText(body.organizationId);
    const source = normalizeText(body.source) || "ezitrack_email";
    const records = Array.isArray(body.records) ? body.records : [];

    if (!organizationId) return jsonResponse({ error: "organizationId is required." }, 400);
    if (records.length === 0) return jsonResponse({ error: "records must contain at least one row." }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: batch, error: batchError } = await supabase
      .from("fleet_import_batches")
      .insert({
        organization_id: organizationId,
        source,
        import_type: "daily_report",
        file_name: body.fileName ?? null,
        status: "processing",
        total_rows: records.length,
        metadata: {
          email_subject: body.emailSubject ?? null,
          email_from: body.emailFrom ?? null,
          received_at: body.receivedAt ?? null,
        },
      })
      .select("id")
      .single();

    if (batchError) throw batchError;

    const { data: vehicles, error: vehiclesError } = await supabase
      .from("fleet_vehicles")
      .select("id, vehicle_name, registration_number, current_odometer_km")
      .eq("organization_id", organizationId);

    if (vehiclesError) throw vehiclesError;

    const vehicleMap = new Map<string, VehicleRow>();
    for (const vehicle of (vehicles ?? []) as VehicleRow[]) {
      if (vehicle.vehicle_name) vehicleMap.set(normalizeMatch(vehicle.vehicle_name), vehicle);
      if (vehicle.registration_number) vehicleMap.set(normalizeMatch(vehicle.registration_number), vehicle);
    }

    let importedRows = 0;
    let failedRows = 0;
    const unmatchedVehicles: string[] = [];

    for (const [index, record] of records.entries()) {
      const rowNumber = index + 1;
      const objectName = getVehicleName(record);
      const vehicle = vehicleMap.get(normalizeMatch(objectName));

      if (!vehicle) {
        failedRows += 1;
        unmatchedVehicles.push(objectName || `row ${rowNumber}`);
        await supabase.from("fleet_import_rows").insert({
          organization_id: organizationId,
          batch_id: batch.id,
          row_number: rowNumber,
          raw_data: record.rawData ?? record,
          mapped_data: { object: objectName },
          status: "unmatched",
          error_message: `No vehicle matched object "${objectName}".`,
        });
        continue;
      }

      try {
        const summary = mapDailySummary(
          organizationId,
          vehicle.id,
          source,
          record,
          body.receivedAt,
        );

        const { error: summaryError } = await supabase
          .from("fleet_daily_summaries")
          .upsert(summary, {
            onConflict: "vehicle_id,summary_date,source",
          });

        if (summaryError) throw summaryError;

        if (
          summary.odometer_km !== null &&
          Number(summary.odometer_km) > Number(vehicle.current_odometer_km ?? 0)
        ) {
          await supabase
            .from("fleet_vehicles")
            .update({ current_odometer_km: summary.odometer_km })
            .eq("id", vehicle.id);
        }

        await optionalInsertMileageLog(supabase, {
          organizationId,
          vehicleId: vehicle.id,
          summaryDate: summary.summary_date,
          routeLengthKm: Number(summary.route_length_km ?? 0),
          odometerKm: summary.odometer_km,
          rawData: record.rawData ?? record,
        });

        await optionalInsertFuelLog(supabase, {
          organizationId,
          vehicleId: vehicle.id,
          summaryDate: summary.summary_date,
          litres: summary.fuel_consumption_litres,
          cost: summary.fuel_cost,
          currency: summary.currency,
          odometerKm: summary.odometer_km,
          rawData: record.rawData ?? record,
        });

        importedRows += 1;
        await supabase.from("fleet_import_rows").insert({
          organization_id: organizationId,
          batch_id: batch.id,
          row_number: rowNumber,
          raw_data: record.rawData ?? record,
          mapped_data: summary,
          vehicle_id: vehicle.id,
          status: "imported",
        });
      } catch (error) {
        failedRows += 1;
        await supabase.from("fleet_import_rows").insert({
          organization_id: organizationId,
          batch_id: batch.id,
          row_number: rowNumber,
          raw_data: record.rawData ?? record,
          mapped_data: { object: objectName, vehicle_id: vehicle.id },
          vehicle_id: vehicle.id,
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const status = failedRows === 0
      ? "completed"
      : importedRows === 0
        ? "failed"
        : "partial_failed";

    await supabase
      .from("fleet_import_batches")
      .update({
        status,
        imported_rows: importedRows,
        failed_rows: failedRows,
        completed_at: new Date().toISOString(),
        metadata: {
          email_subject: body.emailSubject ?? null,
          email_from: body.emailFrom ?? null,
          received_at: body.receivedAt ?? null,
          unmatched_vehicles: unmatchedVehicles,
        },
      })
      .eq("id", batch.id);

    await createNotification(supabase, {
      organizationId,
      importedRows,
      failedRows,
      batchId: batch.id,
    });

    return jsonResponse({
      batchId: batch.id,
      status,
      importedRows,
      failedRows,
      unmatchedVehicles,
    });
  } catch (error) {
    console.error("EZITRACK IMPORT ERROR:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "EziTrack import failed." },
      500,
    );
  }
});
