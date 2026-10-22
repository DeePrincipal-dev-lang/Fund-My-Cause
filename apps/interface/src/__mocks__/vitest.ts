export const describe = (global as any).describe;
export const it = (global as any).it;
export const test = (global as any).test;
export const expect = (global as any).expect;
export const beforeEach = (global as any).beforeEach;
export const afterEach = (global as any).afterEach;
export const beforeAll = (global as any).beforeAll;
export const afterAll = (global as any).afterAll;

export const vi = {
  fn: (impl?: any) => jest.fn(impl),
  spyOn: (obj: any, method: any) => (jest.spyOn as any)(obj, method),
  mock: (path: any, factory?: any) => (jest.mock as any)(path, factory),
  clearAllMocks: () => jest.clearAllMocks(),
  resetAllMocks: () => jest.resetAllMocks(),
  restoreAllMocks: () => jest.restoreAllMocks(),
  useFakeTimers: () => jest.useFakeTimers(),
  useRealTimers: () => jest.useRealTimers(),
  advanceTimersByTime: (ms: number) => jest.advanceTimersByTime(ms),
  runAllTimers: () => jest.runAllTimers(),
};
