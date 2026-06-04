import { CalendarRange, MapPinned, Plus, Settings2 } from "lucide-react";
import type { CalendarViewMode } from "../types";

type Props = {
  title: string;
  subtitle: string;
  rangeStart: string;
  rangeEnd: string;
  viewMode: CalendarViewMode;
  locationFilter: string;
  roleFilter?: string;
  employeeFilter?: string;
  locations: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; name: string }>;
  employees?: Array<{ id: string; name: string }>;
  showAdminActions?: boolean;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onLocationFilterChange: (value: string) => void;
  onRoleFilterChange?: (value: string) => void;
  onEmployeeFilterChange?: (value: string) => void;
  onCreateSlot?: () => void;
  onManageLocations?: () => void;
  onManageRoles?: () => void;
};

const selectClass =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500";

export default function PlannerTopBar({
  title,
  subtitle,
  rangeStart,
  rangeEnd,
  viewMode,
  locationFilter,
  roleFilter = "all",
  employeeFilter = "all",
  locations,
  roles = [],
  employees = [],
  showAdminActions,
  onRangeStartChange,
  onRangeEndChange,
  onViewModeChange,
  onLocationFilterChange,
  onRoleFilterChange,
  onEmployeeFilterChange,
  onCreateSlot,
  onManageLocations,
  onManageRoles,
}: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-500">
          Scheduling
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <CalendarRange size={14} className="text-orange-500" />
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => onRangeStartChange(e.target.value)}
            className="bg-transparent text-sm text-gray-900 outline-none"
          />
          <span>to</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => onRangeEndChange(e.target.value)}
            className="bg-transparent text-sm text-gray-900 outline-none"
          />
        </label>

        <div className="flex rounded-xl border border-gray-200 bg-white p-0.5">
          {(["day", "week", "month"] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize",
                viewMode === mode
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              {mode}
            </button>
          ))}
        </div>

        <select
          value={locationFilter}
          onChange={(e) => onLocationFilterChange(e.target.value)}
          className={selectClass}
        >
          <option value="all">All locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        {onRoleFilterChange ? (
          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value)}
            className={selectClass}
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        ) : null}

        {onEmployeeFilterChange ? (
          <select
            value={employeeFilter}
            onChange={(e) => onEmployeeFilterChange(e.target.value)}
            className={selectClass}
          >
            <option value="all">All employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        ) : null}

        {showAdminActions ? (
          <>
            <button
              type="button"
              onClick={onCreateSlot}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              <Plus size={16} /> Create Slot
            </button>
            <button
              type="button"
              onClick={onManageLocations}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:border-orange-400"
            >
              <MapPinned size={16} /> Manage Locations
            </button>
            <button
              type="button"
              onClick={onManageRoles}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:border-orange-400"
            >
              <Settings2 size={16} /> Manage Roles
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
