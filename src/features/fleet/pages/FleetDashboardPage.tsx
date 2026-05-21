import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Gauge,
  Loader2,
  Plus,
  RefreshCw,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  createFuelPurchase,
  createMaintenanceRecord,
  fetchFleetDashboardData,
  resolveVehicleServiceDefaults,
  type CreateFuelPurchaseInput,
  type CreateMaintenanceRecordInput,
  type FleetDashboardData,
  type FleetServiceResolution,
  type FleetVehicle,
} from "../services/fleetService";

const EMPTY_DATA: FleetDashboardData = {
  vehicles: [],
  summaries: [],
  batches: [],
  rows: [],
  fuelPurchases: [],
  serviceSchedules: [],
  maintenanceRecords: [],
};

type Modal = "service" | "fuel" | null;

type ServiceForm = {
  vehicleId: string;
  serviceDate: string;
  serviceType: string;
  nextServiceOdometerKm: string;
  nextServiceDate: string;
  provider: string;
  cost: string;
  currency: string;
  receiptUrl: string;
  notes: string;
};

type FuelForm = {
  vehicleId: string;
  purchaseDate: string;
  litres: string;
  totalCost: string;
  currency: string;
  odometerKm: string;
  stationName: string;
  paymentMethod: string;
  receiptNumber: string;
  receiptUrl: string;
  notes: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value?: number | null, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function inputClassName() {
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400/70 disabled:cursor-not-allowed disabled:opacity-70";
}

function buttonClassName(kind: "primary" | "ghost" = "primary") {
  if (kind === "ghost") {
    return "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10";
  }
  return "inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60";
}

function vehicleName(vehicle?: Pick<FleetVehicle, "vehicle_name" | "registration_number"> | null) {
  if (!vehicle) return "Unknown vehicle";
  return vehicle.vehicle_name || vehicle.registration_number || "Unnamed vehicle";
}

function statusLabel(status?: string | null) {
  if (status === "service_overdue") return "Service overdue";
  if (status === "service_soon") return "Service needed soon";
  return "Service OK";
}

function serviceStatusClass(status?: string | null) {
  if (status === "service_overdue") return "border-red-400/40 bg-red-500/15 text-red-100";
  if (status === "service_soon") return "border-orange-400/40 bg-orange-500/15 text-orange-100";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
}

function cardClassName(status?: string | null) {
  if (status === "service_overdue") return "border-red-500/40 bg-red-500/10";
  if (status === "service_soon") return "border-orange-500/40 bg-orange-500/10";
  return "border-white/10 bg-white/5";
}

function resolveVehicleStatus(vehicle: FleetVehicle, data: FleetDashboardData) {
  const latestSummary = data.summaries
    .filter((summary) => summary.vehicle_id === vehicle.id && summary.odometer_km !== null)
    .sort((a, b) => b.summary_date.localeCompare(a.summary_date))[0];
  const currentOdo = latestSummary?.odometer_km ?? vehicle.current_odometer_km ?? null;
  const nextServiceOdo = vehicle.next_service_odometer_km ?? null;
  const remainingKm =
    currentOdo !== null && nextServiceOdo !== null ? nextServiceOdo - currentOdo : null;
  const status =
    remainingKm !== null && remainingKm <= 0
      ? "service_overdue"
      : remainingKm !== null && remainingKm <= 1000
        ? "service_soon"
        : vehicle.service_status || "service_ok";

  return {
    currentOdo,
    remainingKm,
    status,
    latestOdometerDate: latestSummary?.summary_date ?? vehicle.latest_odometer_at ?? null,
  };
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs text-white/40">{helper}</p>
        </div>
        <span className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-orange-300">
          {icon}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
      <Truck className="mx-auto text-white/40" size={28} />
      <h3 className="mt-3 font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-white/50">{message}</p>
    </div>
  );
}

export default function FleetDashboardPage() {
  const auth = useAuth();
  const organizationId = auth.profile?.organization_id ?? null;
  const userId = auth.user?.id ?? null;
  const [data, setData] = useState<FleetDashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [serviceDefaults, setServiceDefaults] = useState<FleetServiceResolution | null>(null);
  const [serviceDefaultsLoading, setServiceDefaultsLoading] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    vehicleId: "",
    serviceDate: todayKey(),
    serviceType: "Routine service",
    nextServiceOdometerKm: "",
    nextServiceDate: "",
    provider: "",
    cost: "",
    currency: "USD",
    receiptUrl: "",
    notes: "",
  });
  const [fuelForm, setFuelForm] = useState<FuelForm>({
    vehicleId: "",
    purchaseDate: todayKey(),
    litres: "",
    totalCost: "",
    currency: "USD",
    odometerKm: "",
    stationName: "",
    paymentMethod: "",
    receiptNumber: "",
    receiptUrl: "",
    notes: "",
  });

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const dashboardData = await fetchFleetDashboardData(organizationId, {
        mode: "fixed",
        startDate: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        endDate: todayKey(),
      });
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fleet dashboard.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function resolveDefaults() {
      if (!organizationId || !serviceForm.vehicleId || !serviceForm.serviceDate) {
        setServiceDefaults(null);
        return;
      }
      try {
        setServiceDefaultsLoading(true);
        const resolved = await resolveVehicleServiceDefaults({
          organizationId,
          vehicleId: serviceForm.vehicleId,
          serviceDate: serviceForm.serviceDate,
        });
        setServiceDefaults(resolved);
        setServiceForm((current) => ({
          ...current,
          nextServiceOdometerKm:
            current.nextServiceOdometerKm || resolved.nextServiceOdometerKm?.toString() || "",
          nextServiceDate:
            current.nextServiceDate || resolved.estimatedNextServiceDate || "",
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resolve service defaults.");
      } finally {
        setServiceDefaultsLoading(false);
      }
    }

    void resolveDefaults();
  }, [organizationId, serviceForm.vehicleId, serviceForm.serviceDate]);

  const metrics = useMemo(() => {
    const vehicleStatuses = data.vehicles.map((vehicle) => resolveVehicleStatus(vehicle, data));
    return {
      total: data.vehicles.length,
      active: data.vehicles.filter((vehicle) => vehicle.status === "active").length,
      maintenance: data.vehicles.filter((vehicle) => vehicle.status === "maintenance").length,
      overdue: vehicleStatuses.filter((item) => item.status === "service_overdue").length,
      soon: vehicleStatuses.filter((item) => item.status === "service_soon").length,
      ok: vehicleStatuses.filter((item) => item.status === "service_ok").length,
    };
  }, [data]);

  const vehicleRows = useMemo(
    () =>
      data.vehicles
        .map((vehicle) => ({
          vehicle,
          resolved: resolveVehicleStatus(vehicle, data),
        }))
        .sort((a, b) => {
          const statusRank: Record<string, number> = {
            service_overdue: 0,
            service_soon: 1,
            service_ok: 2,
          };
          return (
            (statusRank[a.resolved.status] ?? 3) -
              (statusRank[b.resolved.status] ?? 3) ||
            vehicleName(a.vehicle).localeCompare(vehicleName(b.vehicle))
          );
        }),
    [data],
  );

  function openServiceModal(vehicleId?: string) {
    setServiceForm({
      vehicleId: vehicleId ?? data.vehicles[0]?.id ?? "",
      serviceDate: todayKey(),
      serviceType: "Routine service",
      nextServiceOdometerKm: "",
      nextServiceDate: "",
      provider: "",
      cost: "",
      currency: "USD",
      receiptUrl: "",
      notes: "",
    });
    setServiceDefaults(null);
    setModal("service");
  }

  function openFuelModal(vehicleId?: string) {
    setFuelForm({
      vehicleId: vehicleId ?? data.vehicles[0]?.id ?? "",
      purchaseDate: todayKey(),
      litres: "",
      totalCost: "",
      currency: "USD",
      odometerKm: "",
      stationName: "",
      paymentMethod: "",
      receiptNumber: "",
      receiptUrl: "",
      notes: "",
    });
    setModal("fuel");
  }

  async function handleServiceSubmit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    if (
      serviceDefaults?.currentOdometerKm === null ||
      serviceDefaults?.currentOdometerKm === undefined
    ) {
      setError("No current odometer found. Import EziTrack data first or update vehicle odometer.");
      return;
    }
    try {
      setSaving(true);
      const payload: CreateMaintenanceRecordInput = {
        organizationId,
        vehicleId: serviceForm.vehicleId,
        serviceDate: serviceForm.serviceDate,
        odometerKm: serviceDefaults.currentOdometerKm,
        serviceType: serviceForm.serviceType,
        nextServiceOdometerKm: Number(serviceForm.nextServiceOdometerKm),
        nextServiceDate: serviceForm.nextServiceDate || null,
        provider: serviceForm.provider,
        cost: serviceForm.cost ? Number(serviceForm.cost) : null,
        currency: serviceForm.currency,
        receiptUrl: serviceForm.receiptUrl,
        notes: serviceForm.notes,
        createdBy: userId,
      };
      await createMaintenanceRecord(payload);
      setMessage("Service record saved and vehicle service status updated.");
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save service record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFuelSubmit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    try {
      setSaving(true);
      const payload: CreateFuelPurchaseInput = {
        organizationId,
        vehicleId: fuelForm.vehicleId,
        purchaseDate: fuelForm.purchaseDate,
        litres: Number(fuelForm.litres),
        totalCost: Number(fuelForm.totalCost),
        currency: fuelForm.currency,
        odometerKm: fuelForm.odometerKm ? Number(fuelForm.odometerKm) : null,
        stationName: fuelForm.stationName,
        paymentMethod: fuelForm.paymentMethod,
        receiptNumber: fuelForm.receiptNumber,
        receiptUrl: fuelForm.receiptUrl,
        notes: fuelForm.notes,
        recordedBy: userId,
      };
      await createFuelPurchase(payload);
      setMessage("Fuel purchase recorded.");
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save fuel purchase.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading fleet management...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={auth.profile?.primary_role ?? null} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Fleet Management
              </p>
              <h1 className="mt-2 text-3xl font-bold">Service Tracking</h1>
              <p className="mt-2 text-sm text-white/50">
                EziTrack odometer readings now drive service defaults automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void load()} className={buttonClassName("ghost")}>
                <RefreshCw size={16} />
                Refresh
              </button>
              <button type="button" onClick={() => openFuelModal()} className={buttonClassName("ghost")}>
                <Fuel size={16} />
                Fuel purchase
              </button>
              <button type="button" onClick={() => openServiceModal()} className={buttonClassName()}>
                <Plus size={16} />
                Add service record
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
              {message}
            </div>
          ) : null}

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Total Vehicles" value={String(metrics.total)} helper="Fleet inventory" icon={<Truck size={18} />} />
            <MetricCard label="Service Overdue" value={String(metrics.overdue)} helper="Needs service now" icon={<AlertTriangle size={18} />} />
            <MetricCard label="Service Soon" value={String(metrics.soon)} helper="Within 1000 km or 14 days" icon={<Wrench size={18} />} />
            <MetricCard label="Service OK" value={String(metrics.ok)} helper="Healthy service window" icon={<CheckCircle2 size={18} />} />
            <MetricCard label="In Maintenance" value={String(metrics.maintenance)} helper="Vehicle status" icon={<Wrench size={18} />} />
            <MetricCard label="Active Vehicles" value={String(metrics.active)} helper="Operational vehicles" icon={<Gauge size={18} />} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="font-semibold text-white">Vehicle Register</h2>
                <p className="mt-1 text-xs text-white/45">
                  Fleet status, odometer, service window and quick actions in one table.
                </p>
              </div>
              <button type="button" onClick={() => openServiceModal()} className={buttonClassName()}>
                <Plus size={15} />
                Add service
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/40 text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Vehicle</th>
                    <th className="px-4 py-3 font-semibold">Registration</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Current km</th>
                    <th className="px-4 py-3 font-semibold">Next service km</th>
                    <th className="px-4 py-3 font-semibold">Remaining</th>
                    <th className="px-4 py-3 font-semibold">Next service</th>
                    <th className="px-4 py-3 font-semibold">Latest odo</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleRows.map(({ vehicle, resolved }) => (
                    <tr
                      key={vehicle.id}
                      className={`border-t border-white/10 ${cardClassName(resolved.status)}`}
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        {vehicleName(vehicle)}
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        {vehicle.registration_number || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${serviceStatusClass(resolved.status)}`}>
                          {statusLabel(resolved.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        {formatNumber(resolved.currentOdo)} km
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        {formatNumber(vehicle.next_service_odometer_km)} km
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        {resolved.remainingKm === null
                          ? "-"
                          : `${formatNumber(resolved.remainingKm)} km`}
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        {formatDate(vehicle.next_service_date)}
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        {formatDate(resolved.latestOdometerDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openServiceModal(vehicle.id)}
                            className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
                          >
                            Service
                          </button>
                          <button
                            type="button"
                            onClick={() => openFuelModal(vehicle.id)}
                            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
                          >
                            Fuel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.vehicles.length === 0 ? (
            <EmptyState title="No fleet vehicles found" message="Import EziTrack data or add vehicles before recording service history." />
          ) : null}

          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <Panel title="Recent Service Records">
              {data.maintenanceRecords.length === 0 ? (
                <p className="text-sm text-white/50">No service records yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.maintenanceRecords.slice(0, 8).map((record) => (
                    <div key={record.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-semibold">{vehicleName(record.vehicle)}</p>
                          <p className="mt-1 text-sm text-white/50">{record.service_type} · {formatDate(record.service_date)}</p>
                        </div>
                        <p className="text-sm text-white/60">{formatNumber(record.odometer_km)} km</p>
                      </div>
                      {record.description ? <p className="mt-2 text-sm text-white/55">{record.description}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Fuel Purchases">
              {data.fuelPurchases.length === 0 ? (
                <p className="text-sm text-white/50">No fuel purchases yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.fuelPurchases.slice(0, 8).map((purchase) => (
                    <div key={purchase.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-semibold">{vehicleName(purchase.vehicle)}</p>
                          <p className="mt-1 text-sm text-white/50">{formatDate(purchase.purchase_date)} · {purchase.station_name || "Station not set"}</p>
                        </div>
                        <p className="text-sm text-white/60">{formatNumber(purchase.litres, 2)} L · {purchase.currency} {formatNumber(purchase.total_cost, 2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </section>

          <section className="mt-8">
            <Panel title="Recent EziTrack Imports">
              {data.batches.length === 0 ? (
                <p className="text-sm text-white/50">No import batches yet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.batches.slice(0, 6).map((batch) => (
                    <div key={batch.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                      <p className="font-semibold capitalize">{batch.status.replace("_", " ")}</p>
                      <p className="mt-1 text-sm text-white/50">{batch.file_name || batch.source}</p>
                      <p className="mt-2 text-xs text-white/40">{batch.imported_rows}/{batch.total_rows} rows imported</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </section>
        </main>
      </div>

      {modal === "service" ? (
        <ServiceModal
          vehicles={data.vehicles}
          form={serviceForm}
          setForm={setServiceForm}
          defaults={serviceDefaults}
          loading={serviceDefaultsLoading}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={handleServiceSubmit}
        />
      ) : null}

      {modal === "fuel" ? (
        <FuelModal
          vehicles={data.vehicles}
          form={fuelForm}
          setForm={setFuelForm}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={handleFuelSubmit}
        />
      ) : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ServiceModal({
  vehicles,
  form,
  setForm,
  defaults,
  loading,
  saving,
  onClose,
  onSubmit,
}: {
  vehicles: FleetVehicle[];
  form: ServiceForm;
  setForm: (form: ServiceForm) => void;
  defaults: FleetServiceResolution | null;
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <ModalShell title="Add Service Record" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Vehicle</span>
            <select
              value={form.vehicleId}
              onChange={(event) => setForm({ ...form, vehicleId: event.target.value, nextServiceDate: "", nextServiceOdometerKm: "" })}
              className={inputClassName()}
              required
            >
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicleName(vehicle)}</option>
              ))}
            </select>
          </label>
          <Field label="Service date" type="date" value={form.serviceDate} onChange={(value) => setForm({ ...form, serviceDate: value, nextServiceDate: "" })} />
          <Field label="Service type" value={form.serviceType} onChange={(value) => setForm({ ...form, serviceType: value })} />
          <Field label="Current odometer from EziTrack" value={defaults?.currentOdometerKm?.toString() ?? ""} readOnly warning={defaults?.odometerWarning ?? null} />
          <Field label="Next service odometer" type="number" value={form.nextServiceOdometerKm} onChange={(value) => setForm({ ...form, nextServiceOdometerKm: value })} helper={defaults ? `Resolved from ${defaults.nextServiceOdometerSource.replace("_", " ")}` : undefined} />
          <Field label="Estimated next service date" type="date" value={form.nextServiceDate} onChange={(value) => setForm({ ...form, nextServiceDate: value })} />
          <Field label="Average daily km" value={defaults?.averageDailyKm?.toString() ?? ""} readOnly warning={defaults?.estimateWarning ?? null} />
          <Field label="Estimated days left" value={defaults?.estimatedDaysToService?.toString() ?? ""} readOnly />
          <Field label="Vendor / mechanic" value={form.provider} onChange={(value) => setForm({ ...form, provider: value })} />
          <Field label="Cost" type="number" value={form.cost} onChange={(value) => setForm({ ...form, cost: value })} />
          <Field label="Currency" value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} />
          <Field label="Receipt URL" value={form.receiptUrl} onChange={(value) => setForm({ ...form, receiptUrl: value })} />
        </div>
        {defaults ? (
          <div className={`rounded-xl border p-4 ${serviceStatusClass(defaults.serviceStatus)}`}>
            <p className="font-semibold">{defaults.serviceMessage}</p>
            <p className="mt-1 text-sm opacity-80">Remaining distance: {formatNumber(defaults.remainingKm)} km</p>
          </div>
        ) : null}
        {loading ? <p className="text-sm text-white/50">Resolving EziTrack odometer and service estimate...</p> : null}
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Notes</span>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} className={inputClassName()} />
        </label>
        <div className="flex justify-end gap-2 border-t border-white/10 pt-5">
          <button type="button" onClick={onClose} className={buttonClassName("ghost")}>Cancel</button>
          <button
            type="submit"
            disabled={
              saving ||
              defaults?.currentOdometerKm === null ||
              defaults?.currentOdometerKm === undefined
            }
            className={buttonClassName()}
          >
            {saving ? "Saving..." : "Save service record"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function FuelModal({
  vehicles,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  vehicles: FleetVehicle[];
  form: FuelForm;
  setForm: (form: FuelForm) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <ModalShell title="Record Fuel Purchase" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Vehicle</span>
            <select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })} className={inputClassName()} required>
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicleName(vehicle)}</option>)}
            </select>
          </label>
          <Field label="Purchase date" type="date" value={form.purchaseDate} onChange={(value) => setForm({ ...form, purchaseDate: value })} />
          <Field label="Litres" type="number" value={form.litres} onChange={(value) => setForm({ ...form, litres: value })} />
          <Field label="Total cost" type="number" value={form.totalCost} onChange={(value) => setForm({ ...form, totalCost: value })} />
          <Field label="Currency" value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} />
          <Field label="Odometer" type="number" value={form.odometerKm} onChange={(value) => setForm({ ...form, odometerKm: value })} />
          <Field label="Station" value={form.stationName} onChange={(value) => setForm({ ...form, stationName: value })} />
          <Field label="Payment method" value={form.paymentMethod} onChange={(value) => setForm({ ...form, paymentMethod: value })} />
          <Field label="Receipt number" value={form.receiptNumber} onChange={(value) => setForm({ ...form, receiptNumber: value })} />
          <Field label="Receipt URL" value={form.receiptUrl} onChange={(value) => setForm({ ...form, receiptUrl: value })} />
        </div>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Notes</span>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} className={inputClassName()} />
        </label>
        <div className="flex justify-end gap-2 border-t border-white/10 pt-5">
          <button type="button" onClick={onClose} className={buttonClassName("ghost")}>Cancel</button>
          <button type="submit" disabled={saving} className={buttonClassName()}>{saving ? "Saving..." : "Save fuel purchase"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
  warning,
  helper,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  readOnly?: boolean;
  warning?: string | null;
  helper?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/45">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className={inputClassName()}
      />
      {helper ? <p className="text-xs text-white/40">{helper}</p> : null}
      {warning ? <p className="text-xs text-orange-200">{warning}</p> : null}
    </label>
  );
}
