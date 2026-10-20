import multiCurrencyDonations from "./multi-currency-donations.json";

// Campaign and contribution canonical fixtures
export * from "./campaign";
export * from "./contribution";

export interface CurrencyConfig {
  code: string;
  symbol: string;
  decimals: number;
  issuer: string;
  isNative: boolean;
  usdExchangeRate: number;
}

export interface MultiCurrencyContribution {
  contributor: string;
  currency: string;
  amount: number;
  amountStroops?: string;
  amountRaw?: string;
  usdEquivalent: number;
  refundStatus?: string;
  refundAmount?: number;
  timestamp: number;
}

export interface MultiCurrencyScenario {
  id: string;
  name: string;
  targetGoalUsd: number;
  baseCurrency: string;
  targetGoalBaseAmount: number;
  contributions: MultiCurrencyContribution[];
  totalRaisedUsd: number;
  isGoalMet: boolean;
}

export interface MultiCurrencyFixtures {
  description: string;
  supportedCurrencies: CurrencyConfig[];
  scenarios: MultiCurrencyScenario[];
}

export const getMultiCurrencyFixtures = (): MultiCurrencyFixtures => {
  return multiCurrencyDonations as MultiCurrencyFixtures;
};

export const getScenarioById = (id: string): MultiCurrencyScenario | undefined => {
  return (multiCurrencyDonations.scenarios as MultiCurrencyScenario[]).find((s) => s.id === id);
};

export { multiCurrencyDonations };
