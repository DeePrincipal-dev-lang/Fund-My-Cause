import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Null/Undefined Convention', () => {
  it('should have no mixed null/undefined types in packages/types', () => {
    const typesDir = './packages/types';
    if (!fs.existsSync(typesDir)) return;

    let violations = 0;

    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (stat.isFile() && file.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const regex = /(\w+\s*:\s*[^;]+\|?\s*null\s*\|\s*undefined)|(\w+\s*:\s*[^;]+\|?\s*undefined\s*\|\s*null)/g;
          const matches = content.match(regex);
          if (matches) {
            violations += matches.length;
          }
        }
      }
    }

    scanDir(typesDir);
    expect(violations).toBe(0);
  });

  it('should have null/undefined convention documented', () => {
    const docPath = './docs/null-undefined-convention.md';
    expect(fs.existsSync(docPath)).toBe(true);
    
    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('Convention');
  });

  it('should have ESLint custom rule for null/undefined', () => {
    const rulePath = './eslint-rules/no-mixed-null-undefined.js';
    expect(fs.existsSync(rulePath)).toBe(true);
    
    const content = fs.readFileSync(rulePath, 'utf-8');
    expect(content).toContain('TSUnionType');
  });
});
