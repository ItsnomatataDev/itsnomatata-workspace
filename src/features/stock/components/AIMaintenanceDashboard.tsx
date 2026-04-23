import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Calendar, DollarSign, Wrench, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { PredictiveMaintenanceService, type MaintenancePrediction, type AssetRecommendation } from "../services/predictiveMaintenanceService";
import { useAuth } from "../../../app/providers/AuthProvider";

interface AIMaintenanceDashboardProps {
  organizationId: string;
}

export default function AIMaintenanceDashboard({ organizationId }: AIMaintenanceDashboardProps) {
  const [predictions, setPredictions] = useState<MaintenancePrediction[]>([]);
  const [recommendations, setRecommendations] = useState<AssetRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (organizationId) {
      loadMaintenanceData();
    }
  }, [organizationId]);

  const loadMaintenanceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [predictionsData, recommendationsData] = await Promise.all([
        PredictiveMaintenanceService.predictMaintenanceNeeds(organizationId),
        PredictiveMaintenanceService.generateAssetRecommendations(organizationId),
      ]);
      
      setPredictions(predictionsData);
      setRecommendations(recommendationsData);
    } catch (err) {
      console.error("Error loading maintenance data:", err);
      setError("Failed to load AI maintenance insights");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case "critical":
        return <AlertTriangle size={16} className="text-red-400" />;
      case "high":
        return <AlertCircle size={16} className="text-orange-400" />;
      case "medium":
        return <Clock size={16} className="text-yellow-400" />;
      default:
        return <CheckCircle size={16} className="text-green-400" />;
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "critical":
        return "bg-red-500/10 border-red-500/20";
      case "high":
        return "bg-orange-500/10 border-orange-500/20";
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/20";
      default:
        return "bg-green-500/10 border-green-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/10 border-red-500/20 text-red-400";
      case "high":
        return "bg-orange-500/10 border-orange-500/20 text-orange-400";
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
      default:
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-orange-400" />
          <span className="ml-2 text-white/60">Analyzing assets...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const criticalAssets = predictions.filter(p => p.riskLevel === "critical");
  const highRiskAssets = predictions.filter(p => p.riskLevel === "high");
  const urgentRecommendations = recommendations.filter(r => r.priority === "critical" || r.priority === "high");

  return (
    <div className="space-y-6">
      {/* AI Insights Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Critical Assets</p>
              <p className="text-2xl font-bold text-red-400">{criticalAssets.length}</p>
              <p className="text-xs text-white/40">Need immediate attention</p>
            </div>
            <div className="rounded-full bg-red-500/15 p-3">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">High Risk</p>
              <p className="text-2xl font-bold text-orange-400">{highRiskAssets.length}</p>
              <p className="text-xs text-white/40">Schedule maintenance soon</p>
            </div>
            <div className="rounded-full bg-orange-500/15 p-3">
              <AlertCircle size={20} className="text-orange-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Estimated Cost</p>
              <p className="text-2xl font-bold text-yellow-400">
                {formatCurrency(predictions.reduce((sum, p) => sum + p.estimatedCost, 0))}
              </p>
              <p className="text-xs text-white/40">Next 30 days</p>
            </div>
            <div className="rounded-full bg-yellow-500/15 p-3">
              <DollarSign size={20} className="text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Critical Assets Alert */}
      {criticalAssets.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            Critical Maintenance Required
          </h3>
          <div className="space-y-3">
            {criticalAssets.slice(0, 3).map((asset) => (
              <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{asset.assetName}</p>
                  <p className="text-xs text-red-300">{asset.recommendedAction}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getRiskIcon(asset.riskLevel)}
                    <span className="text-xs text-red-300">
                      {asset.estimatedDaysUntilMaintenance <= 0 
                        ? "Overdue" 
                        : `${asset.estimatedDaysUntilMaintenance} days`}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-400">
                    {formatCurrency(asset.estimatedCost)}
                  </p>
                  <p className="text-xs text-red-300">Est. cost</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {urgentRecommendations.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-orange-400" />
            AI Recommendations
          </h3>
          <div className="space-y-3">
            {urgentRecommendations.slice(0, 3).map((rec) => (
              <div key={rec.id} className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{rec.title}</p>
                    <p className="text-xs text-white/60 mt-1">{rec.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs">
                        <span className="text-white/40">Savings:</span>
                        <span className="text-green-400 ml-1">{formatCurrency(rec.estimatedSavings)}</span>
                      </span>
                      <span className="text-xs">
                        <span className="text-white/40">Timeline:</span>
                        <span className="ml-1">{rec.timeline}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">ROI</p>
                    <p className="text-lg font-bold text-green-400">{rec.roi}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance Predictions */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-blue-400" />
          Predictive Maintenance Schedule
        </h3>
        <div className="space-y-2">
          {predictions.slice(0, 5).map((asset) => (
            <div key={asset.id} className={`flex items-center justify-between p-3 rounded-lg border ${getRiskColor(asset.riskLevel)}`}>
              <div className="flex items-center gap-3">
                {getRiskIcon(asset.riskLevel)}
                <div>
                  <p className="text-sm font-medium text-white">{asset.assetName}</p>
                  <p className="text-xs text-white/60">
                    {asset.estimatedDaysUntilMaintenance <= 0 
                      ? "Overdue for maintenance" 
                      : `Maintenance in ${asset.estimatedDaysUntilMaintenance} days`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  {formatCurrency(asset.estimatedCost)}
                </p>
                <p className="text-xs text-white/40">
                  {Math.round(asset.probability * 100)}% probability
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wrench size={18} className="text-purple-400" />
          AI Maintenance Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <h4 className="text-sm font-medium text-purple-400 mb-2">Cost Optimization</h4>
            <p className="text-xs text-white/60">
              Preventive maintenance can save up to 40% compared to emergency repairs
            </p>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Downtime Prevention</h4>
            <p className="text-xs text-white/60">
              Early detection prevents {criticalAssets.length} potential failures
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
