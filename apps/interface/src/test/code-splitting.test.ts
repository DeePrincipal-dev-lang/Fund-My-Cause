import * as fs from 'fs';
import * as path from 'path';

// The heavy analytics components are loaded through next/dynamic in lib/lazy-components.ts.
describe('Code Splitting', () => {
  it('exports a lazy wrapper for each heavy analytics component', () => {
    const lazyComponentsPath = path.join(process.cwd(), 'src/lib/lazy-components.ts');
    const content = fs.readFileSync(lazyComponentsPath, 'utf-8');

    expect(content).toContain('LazyAnalyticsDashboard');
    expect(content).toContain('LazyCampaignAnalytics');
    expect(content).toContain('dynamic');
  });

  it('imports each analytics component from its own module, so it becomes its own chunk', () => {
    const lazyComponentsPath = path.join(process.cwd(), 'src/lib/lazy-components.ts');
    const content = fs.readFileSync(lazyComponentsPath, 'utf-8');

    expect(content).toContain("import('@/components/ui/AnalyticsDashboard')");
    expect(content).toContain("import('@/components/ui/CampaignAnalytics')");
  });

  it('configures loading states for lazy components', () => {
    const lazyComponentsPath = path.join(process.cwd(), 'src/lib/lazy-components.ts');
    const content = fs.readFileSync(lazyComponentsPath, 'utf-8');

    expect(content).toContain('loading:');
    expect(content).toContain('ssr:');
  });
});
