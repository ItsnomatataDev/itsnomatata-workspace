import { supabase } from "../../../lib/supabase/client";

export interface MaintenancePrediction {
  id: string;
  assetId: string;
  assetName: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  probability: number; // 0-1
  estimatedDaysUntilMaintenance: number;
  recommendedAction: string;
  estimatedCost: number;
  factors: Array<{
    type: "usage" | "age" | "condition" | "manufacturer" | "history";
    weight: number;
    description: string;
  }>;
}

export interface AssetRecommendation {
  id: string;
  type: "maintenance" | "replacement" | "reallocation" | "procurement" | "disposal";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  assetIds: string[];
  estimatedSavings: number;
  estimatedCost: number;
  roi: number;
  timeline: string;
  confidence: number;
  reasoning: string[];
}

export class PredictiveMaintenanceService {
  // AI-powered predictive maintenance analysis
  static async predictMaintenanceNeeds(organizationId: string): Promise<MaintenancePrediction[]> {
    try {
      // Get all assets with relevant data
      const { data: assets, error } = await supabase
        .from("assets")
        .select(`
          id,
          asset_name,
          purchase_date,
          expected_life_months,
          warranty_expiry_date,
          status,
          condition,
          purchase_price,
          brand,
          model,
          asset_categories(name),
          stock_locations(name)
        `)
        .eq("organization_id", organizationId)
        .not("purchase_date", "is", null);

      if (error) throw error;

      const predictions: MaintenancePrediction[] = [];

      for (const asset of assets || []) {
        const prediction = this.analyzeAssetForMaintenance(asset);
        if (prediction) {
          predictions.push(prediction);
        }
      }

      return predictions.sort((a, b) => b.probability - a.probability);
    } catch (error) {
      console.error("Error predicting maintenance needs:", error);
      throw new Error("Failed to predict maintenance needs");
    }
  }

  private static analyzeAssetForMaintenance(asset: any): MaintenancePrediction | null {
    const now = new Date();
    const purchaseDate = new Date(asset.purchase_date);
    const ageInDays = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
    const ageInMonths = ageInDays / 30.44;

    let riskScore = 0;
    const factors: MaintenancePrediction["factors"] = [];

    // Age-based risk
    if (asset.expected_life_months) {
      const lifePercentage = (ageInMonths / asset.expected_life_months) * 100;
      if (lifePercentage > 80) {
        riskScore += 0.4;
        factors.push({
          type: "age",
          weight: 0.4,
          description: `Asset is ${lifePercentage.toFixed(1)}% through expected lifespan`,
        });
      } else if (lifePercentage > 60) {
        riskScore += 0.2;
        factors.push({
          type: "age",
          weight: 0.2,
          description: `Asset is ${lifePercentage.toFixed(1)}% through expected lifespan`,
        });
      }
    }

    // Warranty expiry risk
    if (asset.warranty_expiry_date) {
      const warrantyExpiry = new Date(asset.warranty_expiry_date);
      const daysUntilWarrantyExpiry = (warrantyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilWarrantyExpiry < 30) {
        riskScore += 0.3;
        factors.push({
          type: "manufacturer",
          weight: 0.3,
          description: `Warranty expires in ${Math.floor(daysUntilWarrantyExpiry)} days`,
        });
      } else if (daysUntilWarrantyExpiry < 90) {
        riskScore += 0.15;
        factors.push({
          type: "manufacturer",
          weight: 0.15,
          description: `Warranty expires in ${Math.floor(daysUntilWarrantyExpiry)} days`,
        });
      }
    }

    // Condition-based risk
    if (asset.condition) {
      const conditionScores: Record<string, number> = {
        "excellent": 0,
        "good": 0.1,
        "fair": 0.3,
        "poor": 0.6,
        "damaged": 0.9,
      };
      
      const conditionScore = conditionScores[asset.condition.toLowerCase()] || 0.2;
      riskScore += conditionScore;
      
      if (conditionScore > 0.2) {
        factors.push({
          type: "condition",
          weight: conditionScore,
          description: `Asset condition is ${asset.condition}`,
        });
      }
    }

    // Brand reliability (simplified)
    const brandReliability: Record<string, number> = {
      "apple": 0.9,
      "dell": 0.8,
      "hp": 0.75,
      "lenovo": 0.8,
      "microsoft": 0.85,
      "cisco": 0.9,
    };
    
    const reliabilityScore = 1 - (brandReliability[asset.brand?.toLowerCase()] || 0.7);
    riskScore += reliabilityScore * 0.1;
    
    if (reliabilityScore > 0.3) {
      factors.push({
        type: "manufacturer",
        weight: reliabilityScore * 0.1,
        description: `${asset.brand} has average reliability rating`,
      });
    }

    // Skip if risk is too low
    if (riskScore < 0.2) return null;

    // Determine risk level
    let riskLevel: MaintenancePrediction["riskLevel"];
    if (riskScore >= 0.8) riskLevel = "critical";
    else if (riskScore >= 0.6) riskLevel = "high";
    else if (riskScore >= 0.4) riskLevel = "medium";
    else riskLevel = "low";

    // Estimate days until maintenance
    const estimatedDaysUntilMaintenance = Math.max(
      7,
      Math.floor((1 - riskScore) * 365) // Scale based on risk
    );

    // Recommended action and cost
    let recommendedAction: string;
    let estimatedCost: number;

    switch (riskLevel) {
      case "critical":
        recommendedAction = "Immediate inspection and potential replacement";
        estimatedCost = (asset.purchase_price || 0) * 0.15; // 15% of purchase price
        break;
      case "high":
        recommendedAction = "Schedule maintenance within 2 weeks";
        estimatedCost = (asset.purchase_price || 0) * 0.08; // 8% of purchase price
        break;
      case "medium":
        recommendedAction = "Plan maintenance within 1-2 months";
        estimatedCost = (asset.purchase_price || 0) * 0.05; // 5% of purchase price
        break;
      default:
        recommendedAction = "Routine check recommended";
        estimatedCost = (asset.purchase_price || 0) * 0.02; // 2% of purchase price
    }

    return {
      id: `pred_${asset.id}`,
      assetId: asset.id,
      assetName: asset.asset_name,
      riskLevel,
      probability: Math.min(riskScore, 0.95),
      estimatedDaysUntilMaintenance,
      recommendedAction,
      estimatedCost,
      factors,
    };
  }

  // Smart asset recommendations
  static async generateAssetRecommendations(organizationId: string): Promise<AssetRecommendation[]> {
    try {
      const [predictions, assetsResult] = await Promise.all([
        this.predictMaintenanceNeeds(organizationId),
        supabase
          .from("assets")
          .select("id, asset_name, status, purchase_price, purchase_date, last_used_at")
          .eq("organization_id", organizationId),
      ]);

      const assets = assetsResult.data || [];
      const recommendations: AssetRecommendation[] = [];

      // Maintenance recommendations
      const highRiskAssets = predictions.filter((p: any) => p.riskLevel === "critical" || p.riskLevel === "high");
      if (highRiskAssets.length > 0) {
        recommendations.push({
          id: "maintenance_urgent",
          type: "maintenance",
          priority: "critical",
          title: "Urgent Maintenance Required",
          description: `${highRiskAssets.length} assets require immediate attention to prevent failure`,
          assetIds: highRiskAssets.map((a: any) => a.assetId),
          estimatedSavings: highRiskAssets.reduce((sum: number, a: any) => sum + (a.estimatedCost * 2), 0), // Preventing failure saves 2x cost
          estimatedCost: highRiskAssets.reduce((sum: number, a: any) => sum + a.estimatedCost, 0),
          roi: 200,
          timeline: "Immediate",
          confidence: 0.9,
          reasoning: [
            "AI analysis indicates high probability of asset failure",
            "Preventive maintenance costs significantly less than emergency repairs",
            "Risk assessment based on age, condition, and manufacturer reliability",
          ],
        });
      }

      // Underutilization recommendations
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const underutilizedAssets = assets.filter((asset: any) => 
        asset.status === "in_stock" && 
        asset.last_used_at && 
        new Date(asset.last_used_at) < thirtyDaysAgo
      );

      if (underutilizedAssets.length > 0) {
        const totalValue = underutilizedAssets.reduce((sum: number, asset: any) => sum + (asset.purchase_price || 0), 0);
        
        recommendations.push({
          id: "reallocation_opportunity",
          type: "reallocation",
          priority: "medium",
          title: "Asset Reallocation Opportunity",
          description: `${underutilizedAssets.length} assets unused for 30+ days - consider reassignment or disposal`,
          assetIds: underutilizedAssets.map((a: any) => a.id),
          estimatedSavings: totalValue * 0.3, // 30% of value through better utilization
          estimatedCost: totalValue * 0.05, // 5% cost to reallocate
          roi: 600,
          timeline: "2-4 weeks",
          confidence: 0.8,
          reasoning: [
            "Assets sitting idle for extended periods",
            "Reallocation can improve ROI on existing investments",
            "Reduces need for new purchases",
          ],
        });
      }

      // Replacement recommendations
      const oldAssets = assets.filter((asset: any) => {
        if (!asset.purchase_date) return false;
        const ageInMonths = (now.getTime() - new Date(asset.purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        return ageInMonths > 48; // Older than 4 years
      });

      if (oldAssets.length > 0) {
        const totalValue = oldAssets.reduce((sum: number, asset: any) => sum + (asset.purchase_price || 0), 0);
        
        recommendations.push({
          id: "replacement_planning",
          type: "replacement",
          priority: "medium",
          title: "Asset Replacement Planning",
          description: `${oldAssets.length} assets are 4+ years old - plan for replacement`,
          assetIds: oldAssets.map((a: any) => a.id),
          estimatedSavings: totalValue * 0.4, // 40% efficiency gains from new equipment
          estimatedCost: totalValue * 1.2, // 120% of current value for replacements
          roi: 33,
          timeline: "6-12 months",
          confidence: 0.7,
          reasoning: [
            "Assets beyond typical 3-4 year lifecycle",
            "New technology offers improved efficiency",
            "Planned replacement reduces emergency failures",
          ],
        });
      }

      return recommendations.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      throw new Error("Failed to generate asset recommendations");
    }
  }

  // Get maintenance schedule
  static async getMaintenanceSchedule(organizationId: string, daysAhead: number = 30): Promise<{
    upcoming: MaintenancePrediction[];
    overdue: MaintenancePrediction[];
    summary: {
      total: number;
      critical: number;
      high: number;
      estimatedCost: number;
    };
  }> {
    try {
      const predictions = await this.predictMaintenanceNeeds(organizationId);
      const now = new Date();

      const upcoming = predictions.filter(p => 
        p.estimatedDaysUntilMaintenance <= daysAhead && p.estimatedDaysUntilMaintenance > 0
      );

      const overdue = predictions.filter(p => p.estimatedDaysUntilMaintenance <= 0);

      const summary = {
        total: predictions.length,
        critical: predictions.filter(p => p.riskLevel === "critical").length,
        high: predictions.filter(p => p.riskLevel === "high").length,
        estimatedCost: predictions.reduce((sum, p) => sum + p.estimatedCost, 0),
      };

      return { upcoming, overdue, summary };
    } catch (error) {
      console.error("Error getting maintenance schedule:", error);
      throw new Error("Failed to get maintenance schedule");
    }
  }
}
