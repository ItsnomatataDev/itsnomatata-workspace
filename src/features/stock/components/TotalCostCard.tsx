import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { StockAnalyticsService, type AssetCostMetrics } from "../services/stockAnalyticsService";
import { useAuth } from "../../../app/providers/AuthProvider";

interface TotalCostCardProps {
  organizationId: string;
  refreshTrigger?: number; // Force refresh when this changes
}

export default function TotalCostCard({ organizationId, refreshTrigger }: TotalCostCardProps) {
  const [metrics, setMetrics] = useState<AssetCostMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (organizationId) {
      loadMetrics();
    }
  }, [organizationId, refreshTrigger]);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await StockAnalyticsService.calculateTotalAssetCost(organizationId);
      setMetrics(data);
    } catch (err) {
      console.error("Error loading asset cost metrics:", err);
      setError("Failed to load cost metrics");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/60">Total Asset Value</p>
            <div className="flex items-center gap-2 mt-2">
              <Loader2 size={16} className="animate-spin text-orange-400" />
              <p className="text-2xl font-bold text-white">Loading...</p>
            </div>
          </div>
          <div className="rounded-2xl bg-green-500/15 p-3 text-green-400">
            <DollarSign size={18} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/60">Total Asset Value</p>
            <p className="mt-2 text-2xl font-bold text-red-400">Error</p>
            <p className="text-xs text-red-300 mt-1">{error}</p>
          </div>
          <div className="rounded-2xl bg-red-500/15 p-3 text-red-400">
            <DollarSign size={18} />
          </div>
        </div>
      </div>
    );
  }

  const getTrendIcon = () => {
    // Simple trend calculation based on monthly depreciation
    if (metrics.monthlyDepreciation > 0) {
      return <TrendingDown size={14} className="text-red-400" />;
    }
    return <TrendingUp size={14} className="text-green-400" />;
  };

  const getTrendText = () => {
    if (metrics.monthlyDepreciation > 0) {
      return `Depreciating ${formatCurrency(metrics.monthlyDepreciation, metrics.currency)}/month`;
    }
    return "Value stable";
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-white/60">Total Asset Value</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatCurrency(metrics.totalCost, metrics.currency)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {getTrendIcon()}
            <p className="text-xs text-white/40">{getTrendText()}</p>
          </div>
          
          {/* Additional metrics */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-white/40">Total Assets</p>
              <p className="text-sm font-medium text-white">{formatNumber(metrics.totalAssets)}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Average Cost</p>
              <p className="text-sm font-medium text-white">
                {formatCurrency(metrics.averageCost, metrics.currency)}
              </p>
            </div>
          </div>

          {/* Top category */}
          {metrics.costByCategory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-white/40 mb-1">Top Category</p>
              <p className="text-sm font-medium text-white">
                {metrics.costByCategory[0].categoryName}
              </p>
              <p className="text-xs text-white/40">
                {formatCurrency(metrics.costByCategory[0].totalCost, metrics.currency)} 
                ({metrics.costByCategory[0].percentage.toFixed(1)}%)
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-green-500/15 p-3 text-green-400">
          <DollarSign size={18} />
        </div>
      </div>
    </div>
  );
}
