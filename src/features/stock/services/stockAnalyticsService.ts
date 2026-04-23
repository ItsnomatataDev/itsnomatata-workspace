import { supabase } from "../../../lib/supabase/client";

export interface AssetCostMetrics {
  totalCost: number;
  totalAssets: number;
  averageCost: number;
  costByCategory: Array<{
    categoryName: string;
    totalCost: number;
    assetCount: number;
    percentage: number;
  }>;
  costByStatus: Array<{
    status: string;
    totalCost: number;
    assetCount: number;
    percentage: number;
  }>;
  monthlyDepreciation: number;
  currency: string;
}

export interface AssetReportData {
  summary: {
    totalAssets: number;
    totalCost: number;
    activeAssets: number;
    maintenanceAssets: number;
    retiredAssets: number;
  };
  categories: Array<{
    name: string;
    count: number;
    totalCost: number;
    averageCost: number;
  }>;
  locations: Array<{
    name: string;
    count: number;
    totalCost: number;
  }>;
  depreciation: {
    totalDepreciated: number;
    totalRemaining: number;
    averageAge: number;
  };
  maintenance: Array<{
    assetName: string;
    dueDate: string;
    estimatedCost: number;
  }>;
}

export class StockAnalyticsService {
  static async calculateTotalAssetCost(organizationId: string): Promise<AssetCostMetrics> {
    try {
      const { data: assets, error } = await supabase
        .from("assets")
        .select(`
          purchase_price,
          currency,
          status,
          category_id,
          expected_life_months,
          asset_categories(id, name)
        `)
        .eq("organization_id", organizationId)
        .not("purchase_price", "is", null);

      if (error) throw error;

      const validAssets = assets || [];
      const totalCost = validAssets.reduce((sum, asset) => sum + (asset.purchase_price || 0), 0);
      const totalAssets = validAssets.length;
      const averageCost = totalAssets > 0 ? totalCost / totalAssets : 0;

      // Group by category
      const categoryMap = new Map<string, { cost: number; count: number }>();
      validAssets.forEach(asset => {
        const categoryName = (asset.asset_categories as any)?.name || "Uncategorized";
        const current = categoryMap.get(categoryName) || { cost: 0, count: 0 };
        current.cost += asset.purchase_price || 0;
        current.count += 1;
        categoryMap.set(categoryName, current);
      });

      const costByCategory = Array.from(categoryMap.entries()).map(([name, data]) => ({
        categoryName: name,
        totalCost: data.cost,
        assetCount: data.count,
        percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      })).sort((a, b) => b.totalCost - a.totalCost);

      // Group by status
      const statusMap = new Map<string, { cost: number; count: number }>();
      validAssets.forEach(asset => {
        const status = asset.status || "unknown";
        const current = statusMap.get(status) || { cost: 0, count: 0 };
        current.cost += asset.purchase_price || 0;
        current.count += 1;
        statusMap.set(status, current);
      });

      const costByStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
        status,
        totalCost: data.cost,
        assetCount: data.count,
        percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      })).sort((a, b) => b.totalCost - a.totalCost);

      // Calculate monthly depreciation (simple straight-line depreciation)
      const monthlyDepreciation = validAssets.reduce((sum, asset) => {
        if (asset.purchase_price && asset.expected_life_months) {
          return sum + (asset.purchase_price / asset.expected_life_months);
        }
        return sum;
      }, 0);

      // Get most common currency
      const currencyCounts = validAssets.reduce((acc, asset) => {
        const currency = asset.currency || "USD";
        acc[currency] = (acc[currency] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const primaryCurrency = Object.entries(currencyCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || "USD";

      return {
        totalCost,
        totalAssets,
        averageCost,
        costByCategory,
        costByStatus,
        monthlyDepreciation,
        currency: primaryCurrency,
      };
    } catch (error) {
      console.error("Error calculating total asset cost:", error);
      throw new Error("Failed to calculate asset costs");
    }
  }

  static async generateAssetReport(organizationId: string): Promise<AssetReportData> {
    try {
      const { data: assets, error } = await supabase
        .from("assets")
        .select(`
          *,
          asset_categories(id, name),
          stock_locations(id, name)
        `)
        .eq("organization_id", organizationId);

      if (error) throw error;

      const validAssets = assets || [];
      
      // Summary calculations
      const summary = {
        totalAssets: validAssets.length,
        totalCost: validAssets.reduce((sum, asset) => sum + (asset.purchase_price || 0), 0),
        activeAssets: validAssets.filter(a => a.status === "active").length,
        maintenanceAssets: validAssets.filter(a => a.status === "maintenance").length,
        retiredAssets: validAssets.filter(a => a.status === "retired").length,
      };

      // Category breakdown
      const categoryMap = new Map<string, { count: number; totalCost: number }>();
      validAssets.forEach(asset => {
        const categoryName = asset.asset_categories?.name || "Uncategorized";
        const current = categoryMap.get(categoryName) || { count: 0, totalCost: 0 };
        current.count += 1;
        current.totalCost += asset.purchase_price || 0;
        categoryMap.set(categoryName, current);
      });

      const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        totalCost: data.totalCost,
        averageCost: data.count > 0 ? data.totalCost / data.count : 0,
      })).sort((a, b) => b.totalCost - a.totalCost);

      // Location breakdown
      const locationMap = new Map<string, { count: number; totalCost: number }>();
      validAssets.forEach(asset => {
        const locationName = asset.stock_locations?.name || "Unknown";
        const current = locationMap.get(locationName) || { count: 0, totalCost: 0 };
        current.count += 1;
        current.totalCost += asset.purchase_price || 0;
        locationMap.set(locationName, current);
      });

      const locations = Array.from(locationMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        totalCost: data.totalCost,
      })).sort((a, b) => b.totalCost - a.totalCost);

      // Depreciation calculations
      const now = new Date();
      let totalDepreciated = 0;
      let totalRemaining = 0;
      let totalAge = 0;
      let ageCount = 0;

      validAssets.forEach(asset => {
        if (asset.purchase_price && asset.purchase_date && asset.expected_life_months) {
          const purchaseDate = new Date(asset.purchase_date);
          const ageInMonths = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
          const monthlyDepreciation = asset.purchase_price / asset.expected_life_months;
          const depreciatedAmount = Math.min(monthlyDepreciation * ageInMonths, asset.purchase_price);
          
          totalDepreciated += depreciatedAmount;
          totalRemaining += (asset.purchase_price - depreciatedAmount);
          totalAge += ageInMonths;
          ageCount += 1;
        }
      });

      const depreciation = {
        totalDepreciated,
        totalRemaining,
        averageAge: ageCount > 0 ? totalAge / ageCount : 0,
      };

      // Maintenance schedule
      const maintenance = validAssets
        .filter(asset => asset.warranty_expiry_date)
        .map(asset => ({
          assetName: asset.asset_name,
          dueDate: asset.warranty_expiry_date!,
          estimatedCost: (asset.purchase_price || 0) * 0.1, // Estimate 10% of purchase price for maintenance
        }))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 10); // Top 10 upcoming maintenance

      return {
        summary,
        categories,
        locations,
        depreciation,
        maintenance,
      };
    } catch (error) {
      console.error("Error generating asset report:", error);
      throw new Error("Failed to generate asset report");
    }
  }

  static async getAssetInsights(organizationId: string): Promise<{
    insights: string[];
    recommendations: string[];
    alerts: Array<{
      type: "warning" | "info" | "critical";
      message: string;
      assetId?: string;
    }>;
  }> {
    try {
      const report = await this.generateAssetReport(organizationId);
      const insights: string[] = [];
      const recommendations: string[] = [];
      const alerts: Array<{
        type: "warning" | "info" | "critical";
        message: string;
        assetId?: string;
      }> = [];

      // Generate insights
      const activePercentage = (report.summary.activeAssets / report.summary.totalAssets) * 100;
      insights.push(`${activePercentage.toFixed(1)}% of assets are currently active`);

      const mostValuableCategory = report.categories[0];
      if (mostValuableCategory) {
        insights.push(`${mostValuableCategory.name} category represents the highest investment at $${mostValuableCategory.totalCost.toLocaleString()}`);
      }

      if (report.depreciation.averageAge > 36) {
        insights.push(`Average asset age is ${(report.depreciation.averageAge / 12).toFixed(1)} years`);
      }

      // Generate recommendations
      if (report.summary.maintenanceAssets > 0) {
        recommendations.push(`Schedule maintenance for ${report.summary.maintenanceAssets} assets currently under maintenance`);
      }

      if (report.depreciation.averageAge > 48) {
        recommendations.push("Consider replacing aging assets to improve efficiency and reduce maintenance costs");
      }

      const underutilizedCategories = report.categories.filter(cat => cat.count > 0 && cat.averageCost > 10000);
      if (underutilizedCategories.length > 0) {
        recommendations.push("Review utilization of high-value assets to ensure ROI");
      }

      // Generate alerts
      const upcomingMaintenance = report.maintenance.filter(m => {
        const dueDate = new Date(m.dueDate);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return dueDate <= thirtyDaysFromNow;
      });

      upcomingMaintenance.forEach(maintenance => {
        alerts.push({
          type: "warning",
          message: `Maintenance due for ${maintenance.assetName} on ${new Date(maintenance.dueDate).toLocaleDateString()}`,
        });
      });

      if (report.summary.retiredAssets > report.summary.totalAssets * 0.1) {
        alerts.push({
          type: "info",
          message: `${report.summary.retiredAssets} assets are retired and should be disposed of`,
        });
      }

      return { insights, recommendations, alerts };
    } catch (error) {
      console.error("Error generating asset insights:", error);
      return {
        insights: ["Unable to generate insights at this time"],
        recommendations: ["Please try again later"],
        alerts: [],
      };
    }
  }

  static async updateAssetCostOnCreate(organizationId: string): Promise<void> {
    // This function can be called after asset creation to update any cached cost metrics
    // For now, we'll rely on real-time calculation, but this could be enhanced with caching
    console.log("Asset cost metrics updated for organization:", organizationId);
  }

  static async getCostTrends(organizationId: string, months: number = 12): Promise<{
    monthly: Array<{
      month: string;
      totalCost: number;
      newAssets: number;
    }>;
  }> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data: assets, error } = await supabase
        .from("assets")
        .select("purchase_price, purchase_date")
        .eq("organization_id", organizationId)
        .gte("purchase_date", startDate.toISOString())
        .order("purchase_date", { ascending: true });

      if (error) throw error;

      const monthlyMap = new Map<string, { totalCost: number; newAssets: number }>();
      
      (assets || []).forEach(asset => {
        if (asset.purchase_price && asset.purchase_date) {
          const date = new Date(asset.purchase_date);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          
          const current = monthlyMap.get(monthKey) || { totalCost: 0, newAssets: 0 };
          current.totalCost += asset.purchase_price;
          current.newAssets += 1;
          monthlyMap.set(monthKey, current);
        }
      });

      const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        totalCost: data.totalCost,
        newAssets: data.newAssets,
      }));

      return { monthly };
    } catch (error) {
      console.error("Error getting cost trends:", error);
      return { monthly: [] };
    }
  }
}
