import { BriefcaseBusiness, MapPin, Users } from "lucide-react";
import type { PlannerTabId } from "./plannerBoardTypes";

type Props = {
  activeTab: PlannerTabId;
  onChange: (tab: PlannerTabId) => void;
  counts: Record<PlannerTabId, number>;
};

const tabs: Array<{
  id: PlannerTabId;
  label: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    id: "work_streams",
    label: "Work Streams",
    description: "Editor, social media, design and other slots",
    icon: BriefcaseBusiness,
  },
  {
    id: "locations",
    label: "Locations",
    description: "See who is assigned to each place",
    icon: MapPin,
  },
  {
    id: "unassigned",
    label: "Unassigned",
    description: "Employees not assigned on this date",
    icon: Users,
  },
];

export default function PlannerTabs({ activeTab, onChange, counts }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "rounded-2xl border p-4 text-left transition",
              active
                ? "border-orange-400 bg-orange-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-orange-200",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={[
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl",
                  active ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500",
                ].join(" ")}
              >
                <Icon size={18} />
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
                {counts[tab.id]}
              </span>
            </div>
            <p className="mt-3 font-semibold text-gray-950">{tab.label}</p>
            <p className="mt-1 text-xs text-gray-500">{tab.description}</p>
          </button>
        );
      })}
    </div>
  );
}
