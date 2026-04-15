import { CalendarDays, Clock3, DollarSign, Timer } from "lucide-react";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatMoney(amount: number) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-[#050505] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/45">{title}</p>
          <p className="mt-3 text-2xl font-bold text-white">{value}</p>
          <p className="mt-2 text-xs text-white/35">{subtitle}</p>
        </div>

        <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function MyTimeSummaryCards({
  todaySeconds,
  weekSeconds,
  billableSeconds,
  totalCost,
}: {
  todaySeconds: number;
  weekSeconds: number;
  billableSeconds: number;
  totalCost: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        title="Today"
        value={formatDuration(todaySeconds)}
        subtitle="Tracked in your local day"
        icon={<Clock3 size={18} />}
      />

      <SummaryCard
        title="This Week"
        value={formatDuration(weekSeconds)}
        subtitle="Current week total"
        icon={<CalendarDays size={18} />}
      />

      <SummaryCard
        title="Billable"
        value={formatDuration(billableSeconds)}
        subtitle="Visible billable time"
        icon={<Timer size={18} />}
      />

      <SummaryCard
        title="Cost Snapshot"
        value={formatMoney(totalCost)}
        subtitle="Based on current entry rates"
        icon={<DollarSign size={18} />}
      />
    </div>
  );
}
