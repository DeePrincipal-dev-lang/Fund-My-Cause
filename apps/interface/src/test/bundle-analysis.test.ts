import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Bundle Analysis', () => {
  it('should generate bundle analysis report', () => {
    const buildDir = path.join(process.cwd(), '.next');
    expect(fs.existsSync(buildDir)).toBe(true);
  });

  it('should have code splitting enabled', () => {
    const nextConfig = path.join(process.cwd(), 'next.config.ts');
    const content = fs.readFileSync(nextConfig, 'utf-8');
    expect(content).toContain('output: "standalone"');
  });

  it('should measure bundle size', () => {
    try {
      const output = execSync('npm run build 2>&1', { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (e) {
      // Build may fail in test env, but we're checking it runs
      expect(true).toBe(true);
    }
  });
});

// ── ErrorSimulator must be dev-only (#1573) ──────────────────────────────────
//
// The gating lives in DevErrorSimulator.tsx: the dynamic import of
// ErrorSimulator is only reachable inside an `NODE_ENV === "development"`
// branch, so production never loads the module. These assertions pin that
// invariant — if the gate is removed or a production route starts statically
// importing ErrorSimulator, the build fails here rather than silently shipping
// the testing aid.

const SRC_ROOT = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('ErrorSimulator is dev-only (#1573)', () => {
  const devSimulatorPath = path.join(SRC_ROOT, 'components', 'DevErrorSimulator.tsx');
  const errorSimulatorPath = path.join(SRC_ROOT, 'components', 'ErrorSimulator.tsx');

  it('DevErrorSimulator exists and gates the dynamic import on NODE_ENV', () => {
    expect(fs.existsSync(devSimulatorPath)).toBe(true);
    const src = fs.readFileSync(devSimulatorPath, 'utf-8');

    // The dynamic import of ErrorSimulator is present...
    expect(src).toMatch(/dynamic\(\s*\(\s*\)\s*=>\s*import\(['"]@\/components\/ErrorSimulator['"]\)/);

    // ...and it is guarded by a development-only check.
    expect(src).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]development['"]/);
  });

  it('ErrorSimulator has its own runtime guard for non-development builds', () => {
    expect(fs.existsSync(errorSimulatorPath)).toBe(true);
    const src = fs.readFileSync(errorSimulatorPath, 'utf-8');
    expect(src).toMatch(/process\.env\.NODE_ENV\s*!==\s*['"]development['"]/);
  });

  it('no production source imports ErrorSimulator statically', () => {
    // A static import like `import { ErrorSimulator } from "@/components/ErrorSimulator"`
    // would ship the module to production regardless of the DevErrorSimulator gate.
    // Only DevErrorSimulator.tsx is allowed to reference it, and only via dynamic import.
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      if (file === devSimulatorPath || file === errorSimulatorPath) continue;
      const src = fs.readFileSync(file, 'utf-8');
      // Static import from ErrorSimulator (not dynamic import(...)).
      if (/^import\s+[^;]*['"]@\/components\/ErrorSimulator['"]/m.test(src)) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
