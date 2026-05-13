import type { OrganizationSubscription } from "../types/platformAdmin";

export default function SubscriptionPanel({
  subscription,
  saving,
  onChange,
}: {
  subscription: OrganizationSubscription | null;
  saving?: boolean;
  onChange?: (updates: {
    status?: string;
    planName?: string;
    billingInterval?: string;
    amountUsd?: number;
    paymentMethod?: string;
    notes?: string | null;
  }) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#181818] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
        Manual Plan
      </p>

      <div className="mt-3 space-y-3">
        <input
          value={subscription?.plan_name ?? ""}
          onChange={(event) => onChange?.({ planName: event.target.value })}
          className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
          placeholder="Plan name"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            value={subscription?.status ?? "active"}
            onChange={(event) => onChange?.({ status: event.target.value })}
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
          >
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={subscription?.billing_interval ?? "manual"}
            onChange={(event) =>
              onChange?.({ billingInterval: event.target.value })
            }
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
          >
            <option value="manual">Manual</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        <input
          value={subscription?.amount_usd ?? 0}
          type="number"
          min={0}
          onChange={(event) =>
            onChange?.({ amountUsd: Number(event.target.value) })
          }
          className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
          placeholder="Amount USD"
        />
      </div>

      {subscription?.notes ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
          {subscription.notes}
        </p>
      ) : null}

      {saving ? (
        <p className="mt-3 text-xs font-semibold text-orange-400">Saving...</p>
      ) : null}
    </div>
  );
}
