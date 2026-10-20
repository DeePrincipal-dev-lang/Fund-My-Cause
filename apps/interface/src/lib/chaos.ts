let activeFailure: (FailureConfig & { _target?: string }) | null = null;
let failureCount = 0;

export interface FailureConfig {
  probability: number;
  latencyMs?: number;
  errorMessage?: string;
  statusCode?: number;
}

export interface ChaosConfig {
  rpc?: FailureConfig;
  horizon?: FailureConfig;
  pinata?: FailureConfig;
  coingecko?: FailureConfig;
  search?: FailureConfig;
  websocket?: FailureConfig;
}

export function injectChaos(target: keyof ChaosConfig, config: FailureConfig): void {
  activeFailure = { ...config, _target: target };
  failureCount++;
}

export function clearChaos(): void {
  activeFailure = null;
}

export function getActiveFailure(): FailureConfig & { _target?: string } | null {
  return activeFailure;
}

export function shouldFail(target: string): { shouldFail: boolean; config: FailureConfig | null } {
  if (activeFailure && activeFailure._target === target) {
    if (Math.random() < activeFailure.probability) {
      return { shouldFail: true, config: activeFailure };
    }
  }
  return { shouldFail: false, config: null };
}

export async function withChaos<T>(
  target: keyof ChaosConfig,
  fn: () => Promise<T>,
): Promise<T> {
  const { shouldFail: fail, config } = shouldFail(target);
  if (fail && config) {
    if (config.latencyMs) {
      await new Promise((resolve) => setTimeout(resolve, config.latencyMs));
    }
    if (config.errorMessage) {
      throw new Error(config.errorMessage);
    }
    throw new Error(`${target} failure (injected)`);
  }
  return fn();
}

export function getFailureCount(): number {
  return failureCount;
}

export function resetFailureCount(): void {
  failureCount = 0;
}
