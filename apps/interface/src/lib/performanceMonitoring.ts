/**
 * Performance monitoring and Core Web Vitals tracking
 */

/** Layout-shift and first-input entries are not in lib.dom's typings. */
interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput?: boolean;
  value?: number;
}

interface FirstInputEntry extends PerformanceEntry {
  processingDuration?: number;
}

export interface PerformanceMetrics {
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  ttfb?: number;
  navigationTiming?: PerformanceTiming | PerformanceNavigationTiming;
}

export interface CoreWebVitals {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
}

export interface PerformanceCallback {
  (metrics: PerformanceMetrics): void;
}

/**
 * Measure Core Web Vitals
 */
export function measureCoreWebVitals(
  callback: PerformanceCallback
): void {
  if (typeof window === "undefined" || !performance?.getEntriesByType) return;

  const metrics: PerformanceMetrics = {};

  // First Contentful Paint
  const paintEntries = performance.getEntriesByType("paint");
  const fcp = paintEntries.find((entry) => entry.name === "first-contentful-paint");
  if (fcp) metrics.fcp = fcp.startTime;

  // Largest Contentful Paint
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    metrics.lcp = lastEntry.startTime;
  });

  try {
    observer.observe({ entryTypes: ["largest-contentful-paint"] });
  } catch (e) {
    console.warn("LCP observer not supported");
  }

  // Cumulative Layout Shift
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as LayoutShiftEntry;
      if (!shift.hadRecentInput) {
        clsValue += shift.value ?? 0;
        metrics.cls = clsValue;
      }
    }
  });

  try {
    clsObserver.observe({ entryTypes: ["layout-shift"] });
  } catch (e) {
    console.warn("CLS observer not supported");
  }

  // First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    if (entries.length > 0) {
      metrics.fid = (entries[0] as FirstInputEntry).processingDuration;
    }
  });

  try {
    fidObserver.observe({ entryTypes: ["first-input"] });
  } catch (e) {
    console.warn("FID observer not supported");
  }

  // Time to First Byte
  const navigationTiming = performance.getEntriesByType("navigation")[0];
  if (navigationTiming) {
    metrics.ttfb = (navigationTiming as PerformanceNavigationTiming).responseStart -
      (navigationTiming as PerformanceNavigationTiming).requestStart;
    metrics.navigationTiming = navigationTiming as PerformanceNavigationTiming;
  }

  callback(metrics);
}

/**
 * Get current Core Web Vitals
 */
export function getCoreWebVitals(): CoreWebVitals {
  if (typeof window === "undefined" || !performance?.getEntriesByType) {
    return { lcp: null, fid: null, cls: null };
  }

  const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
  const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null;

  const clsEntries = performance.getEntriesByType("layout-shift");
  let cls = 0;
  for (const entry of clsEntries) {
    const shift = entry as LayoutShiftEntry;
    if (!shift.hadRecentInput) {
      cls += shift.value ?? 0;
    }
  }

  return {
    lcp: lcp as number | null,
    fid: null,
    cls: cls > 0 ? cls : null,
  };
}

/**
 * Measure page load time
 */
export function measurePageLoadTime(): number {
  if (typeof window === "undefined" || !performance?.getEntriesByType) return 0;

  const navigationTiming = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  if (!navigationTiming) return 0;

  return navigationTiming.loadEventEnd - navigationTiming.fetchStart;
}

/**
 * Measure resource timing
 */
export function getResourceTimings(): PerformanceResourceTiming[] {
  if (typeof window === "undefined" || !performance?.getEntriesByType) return [];
  return performance.getEntriesByType("resource") as PerformanceResourceTiming[];
}

/**
 * Report performance metrics
 */
export async function reportPerformanceMetrics(
  endpoint: string,
  metrics: PerformanceMetrics
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
    console.warn("Performance reporting failed:", error);
  }
}

/**
 * Create performance mark
 */
export function markPerformance(name: string): void {
  if (typeof window === "undefined") return;
  if (typeof performance?.mark !== "function") return;
  performance.mark(name);
}

/**
 * Measure between two marks
 */
export function measurePerformance(
  name: string,
  startMark: string,
  endMark: string
): number {
  if (typeof window === "undefined") return 0;
  if (typeof performance?.measure !== "function") return 0;

  try {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name)[0];
    return measure.duration;
  } catch (e) {
    console.warn("Performance measurement failed:", e);
    return 0;
  }
}
