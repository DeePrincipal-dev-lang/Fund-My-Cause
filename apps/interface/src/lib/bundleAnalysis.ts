/**
 * Bundle analysis and optimization utilities
 */

export interface BundleMetrics {
  totalSize: number;
  gzipSize: number;
  dependencies: DependencyInfo[];
  largestModules: ModuleInfo[];
}

export interface DependencyInfo {
  name: string;
  size: number;
  gzipSize: number;
  version?: string;
}

export interface ModuleInfo {
  name: string;
  size: number;
  percentage: number;
}

/**
 * Analyze bundle size from performance entries
 */
export function analyzeBundleSize(): BundleMetrics {
  if (typeof window === "undefined" || !performance?.getEntriesByType) {
    return {
      totalSize: 0,
      gzipSize: 0,
      dependencies: [],
      largestModules: [],
    };
  }

  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const jsResources = resources.filter((r) =>
    r.name.includes(".js")
  );

  let totalSize = 0;
  const dependencies: DependencyInfo[] = [];

  jsResources.forEach((resource) => {
    const size = resource.transferSize || 0;
    totalSize += size;

    const name = resource.name.split("/").pop() || "unknown";
    dependencies.push({
      name,
      size,
      gzipSize: Math.round(size * 0.3),
    });
  });

  const largestModules = dependencies
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map((dep) => ({
      name: dep.name,
      size: dep.size,
      percentage: (dep.size / totalSize) * 100,
    }));

  return {
    totalSize,
    gzipSize: Math.round(totalSize * 0.3),
    dependencies,
    largestModules,
  };
}

/**
 * Identify large dependencies
 */
export function identifyLargeDependencies(
  threshold: number = 100000
): DependencyInfo[] {
  const metrics = analyzeBundleSize();
  return metrics.dependencies.filter((dep) => dep.size > threshold);
}

/**
 * Calculate bundle size reduction potential
 */
export function calculateOptimizationPotential(
  metrics: BundleMetrics
): {
  potentialReduction: number;
  percentage: number;
  recommendations: string[];
} {
  const largeModules = metrics.largestModules.filter(
    (m) => m.percentage > 5
  );

  const potentialReduction = largeModules.reduce(
    (sum, m) => sum + m.size * 0.2,
    0
  );

  const recommendations: string[] = [];

  if (metrics.largestModules[0]?.percentage > 10) {
    recommendations.push(
      `Consider code-splitting ${metrics.largestModules[0].name}`
    );
  }

  if (metrics.largestModules.length > 5) {
    recommendations.push("Consider lazy loading non-critical modules");
  }

  if (metrics.gzipSize > 500000) {
    recommendations.push("Bundle size exceeds 500KB, consider optimization");
  }

  return {
    potentialReduction: Math.round(potentialReduction),
    percentage: Math.round((potentialReduction / metrics.totalSize) * 100),
    recommendations,
  };
}

/**
 * Report bundle metrics
 */
export async function reportBundleMetrics(
  endpoint: string,
  metrics: BundleMetrics
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
      keepalive: true,
    });
  } catch (error) {
    console.warn("Bundle metrics reporting failed:", error);
  }
}

/**
 * Get script execution time
 */
export function getScriptExecutionTime(): Map<string, number> {
  if (typeof window === "undefined" || !performance?.getEntriesByType) return new Map();

  const measures = performance.getEntriesByType("measure");
  const executionTimes = new Map<string, number>();

  measures.forEach((measure) => {
    executionTimes.set(measure.name, measure.duration);
  });

  return executionTimes;
}

/**
 * Detect unused dependencies
 */
export function detectUnusedDependencies(
  usedModules: Set<string>
): string[] {
  const metrics = analyzeBundleSize();
  return metrics.dependencies
    .filter((dep) => !usedModules.has(dep.name))
    .map((dep) => dep.name);
}
