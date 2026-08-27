import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PWA Production Smoke Tests', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  const distDir = path.resolve(__dirname, '../../dist');

  it('should have a valid public manifest.webmanifest with essential PWA fields', () => {
    const manifestPath = path.join(publicDir, 'manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    expect(manifest.name).toBe('LookARemote Controller');
    expect(manifest.short_name).toBe('LookARemote');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#000000');
    expect(manifest.theme_color).toBe('#000000');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const icon192 = manifest.icons.find((i: any) => i.sizes === '192x192');
    const icon512 = manifest.icons.find((i: any) => i.sizes === '512x512');
    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();
  });

  it('should verify physical icon assets exist in public folder', () => {
    expect(fs.existsSync(path.join(publicDir, 'icon-192.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'icon-512.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'favicon.svg'))).toBe(true);
  });

  it('should verify production build output contains index.html and manifest if built', () => {
    if (fs.existsSync(distDir)) {
      expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'manifest.webmanifest'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'sw.js'))).toBe(true);
    }
  });
});
