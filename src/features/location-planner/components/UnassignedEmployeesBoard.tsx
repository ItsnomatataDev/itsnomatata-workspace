import { useMemo, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Search, Trash2, Users } from "lucide-react";
import type { PlannerEmployeeCardModel } from "./plannerBoardTypes";

type Props = {
  employees: PlannerEmployeeCardModel[];
  canEdit?: boolean;
  title?: string;
  description?: string;
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

function EmployeeCard({
  employee,
  canEdit,
}: {
  employee: PlannerEmployeeCardModel;
  canEdit?: boolean;
}) {
  const drag = useDraggable({
    id: `employee-${employee.id}`,
    data: { type: "employee", employeeId: employee.id },
    disabled: !canEdit,
  });

  return (
    <div
      ref={drag.setNodeRef}
      style={
        drag.transform
          ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
          : undefined
      }
      className={[
        "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition",
        canEdit ? "cursor-grab active:cursor-grabbing" : "",
        drag.isDragging ? "opacity-40" : "",
      ].join(" ")}
      {...(canEdit ? { ...drag.listeners, ...drag.attributes } : {})}
    >
      <p className="font-semibold text-gray-950">
        {employee.name || employee.email || "Employee"}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {employee.primaryRole ?? "No role"} {employee.department ? `· ${employee.department}` : ""}
      </p>
      {employee.skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {employee.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function UnassignedEmployeesBoard({
  employees,
  canEdit,
  title = "Free employees",
  description = "Drag a person into a visible slot.",
  compact,
  emptyTitle = "Everyone is assigned for this date",
  emptyDescription = "Unassigned employees will appear here when they have no active placement.",
}: Props) {
  const [query, setQuery] = useState("");
  const removeDrop = useDroppable({
    id: "assignment-remove-zone",
    data: { type: "unassign" },
    disabled: !canEdit,
  });
  const filteredEmployees = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) =>
      [
        employee.name,
        employee.email,
        employee.primaryRole,
        employee.department,
        ...employee.skills,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [employees, query]);

  const content =
    employees.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <Users size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-gray-900">{emptyTitle}</p>
        <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
      </div>
    ) : filteredEmployees.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
        <Search size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-gray-900">No matching employees</p>
        <p className="mt-1 text-sm text-gray-500">Try another name, role, department, or skill.</p>
      </div>
    ) : (
      <div className={compact ? "space-y-3" : "grid gap-4 md:grid-cols-2 xl:grid-cols-4"}>
        {filteredEmployees.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} canEdit={canEdit} />
        ))}
      </div>
    );

  if (compact) {
    return (
      <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-950">
              <Users size={17} className="text-orange-500" />
              {title}
            </p>
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {filteredEmployees.length} / {employees.length}
          </span>
        </div>
        {employees.length > 0 ? (
          <label className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 focus-within:border-orange-300 focus-within:bg-white">
            <Search size={15} className="text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search free employees"
              className="min-w-0 flex-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-400"
            />
          </label>
        ) : null}
        {canEdit ? (
          <div
            ref={removeDrop.setNodeRef}
            className={[
              "mb-4 rounded-xl border border-dashed px-3 py-3 text-center text-xs transition",
              removeDrop.isOver
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-gray-300 bg-gray-50 text-gray-500",
            ].join(" ")}
          >
            <Trash2 size={16} className="mx-auto mb-1" />
            Drop an assigned employee here to remove them from the location/slot.
          </div>
        ) : null}
        {content}
      </aside>
    );
  }

  if (employees.length === 0) {
    return content;
  }

  return content;
}
