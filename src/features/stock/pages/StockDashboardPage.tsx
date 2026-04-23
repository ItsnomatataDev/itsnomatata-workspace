import { useState, useEffect } from "react";
import { Package, TrendingUp, AlertTriangle, Wrench, DollarSign, BarChart3 } from "lucide-react";
import TotalCostCard from "../components/TotalCostCard";
import { StockAnalyticsService, type AssetReportData } from "../services/stockAnalyticsService";
import { useAuth } from "../../../app/providers/AuthProvider";

interface StockDashboardPageProps {
  organizationId: string;
}

export default function StockDashboardPage({ organizationId }: StockDashboardPageProps) {
  const [reportData, setReportData] = useState<AssetReportData | null>(null);
  const [insights, setInsights] = useState<{
    insights: string[];
    recommendations: string[];
    alerts: Array<{
      type: "warning" | "info" | "critical";
      message: string;
      assetId?: string;
    }>;
  }>({ insights: [], recommendations: [], alerts: [] });
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const auth = useAuth();

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      const [report, insightsData] = await Promise.all([
        StockAnalyticsService.generateAssetReport(organizationId),
        StockAnalyticsService.getAssetInsights(organizationId),
      ]);
      
      setReportData(report);
      setInsights(insightsData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
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
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-white/60">Loading stock dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Stock Dashboard</h1>
            <p className="text-white/60 mt-1">Asset management and analytics overview</p>
          </div>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors"
          >
            Refresh Data
          </button>
        </div>

        {/* Alerts */}
        {insights.alerts.length > 0 && (
          <div className="space-y-2">
            {insights.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  alert.type === "critical"
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : alert.type === "warning"
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                }`}
              >
                <p className="text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Cost Card */}
          <TotalCostCard organizationId={organizationId} refreshTrigger={refreshTrigger} />

          {/* Total Assets Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/60">Total Assets</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {reportData ? formatNumber(reportData.summary.totalAssets) : "0"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Package size={14} className="text-blue-400" />
                  <p className="text-xs text-white/40">
                    {reportData ? `${reportData.summary.activeAssets} active` : "Loading..."}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-400">
                <Package size={18} />
              </div>
            </div>
          </div>

          {/* Maintenance Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/60">Maintenance</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {reportData ? formatNumber(reportData.summary.maintenanceAssets) : "0"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Wrench size={14} className="text-yellow-400" />
                  <p className="text-xs text-white/40">Under maintenance</p>
                </div>
              </div>
              <div className="rounded-2xl bg-yellow-500/15 p-3 text-yellow-400">
                <Wrench size={18} />
              </div>
            </div>
          </div>

          {/* Depreciation Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm text-white/60">Depreciation</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {reportData ? formatCurrency(reportData.depreciation.totalDepreciated) : "$0"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-400" />
                  <p className="text-xs text-white/40">
                    {reportData ? `Remaining: ${formatCurrency(reportData.depreciation.totalRemaining)}` : "Loading..."}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-green-500/15 p-3 text-green-400">
                <BarChart3 size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* Insights and Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign size={18} className="text-orange-400" />
              Key Insights
            </h3>
            <div className="space-y-3">
              {insights.insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-white/80">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-400" />
              Recommendations
            </h3>
            <div className="space-y-3">
              {insights.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-white/80">{recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Categories */}
        {reportData && reportData.categories.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Asset Categories</h3>
            <div className="space-y-3">
              {reportData.categories.slice(0, 5).map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <p className="text-sm font-medium text-white">{category.name}</p>
                    <p className="text-xs text-white/40">
                      {formatNumber(category.count)} assets
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {formatCurrency(category.totalCost)}
                    </p>
                    <p className="text-xs text-white/40">
                      Avg: {formatCurrency(category.averageCost)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Maintenance */}
        {reportData && reportData.maintenance.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wrench size={18} className="text-yellow-400" />
              Upcoming Maintenance
            </h3>
            <div className="space-y-3">
              {reportData.maintenance.slice(0, 5).map((maintenance, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <p className="text-sm font-medium text-white">{maintenance.assetName}</p>
                    <p className="text-xs text-white/40">
                      Due: {new Date(maintenance.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-yellow-400">
                      {formatCurrency(maintenance.estimatedCost)}
                    </p>
                    <p className="text-xs text-white/40">Est. cost</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}