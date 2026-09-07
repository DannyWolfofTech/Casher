import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../../..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  overrides?: Record<string, string>;
};

/**
 * Guards the production dependency surface:
 * - test tooling and native packaging CLIs must never sit in `dependencies`
 * - native runtime detection is isolated; packaging tools/test runners stay out
 * - security overrides pinned for known advisories must stay in place
 */
describe("production dependency hygiene", () => {
  it("keeps test tooling and native packaging tools out of runtime dependencies", () => {
    const runtime = Object.keys(pkg.dependencies);
    for (const name of ["vitest", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"]) {
      expect(runtime).not.toContain(name);
      expect(Object.keys(pkg.devDependencies)).toContain(name);
    }
  });

  it("isolates Capacitor core to the platform boundary and excludes test tooling", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "__tests__") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    walk(join(root, "src"));

    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      const importsNative = /from\s+["']@capacitor\//.test(src);
      const permittedCore = f === join(root, 'src', 'lib', 'mobile-platform.ts') && /from\s+["']@capacitor\/core["']/.test(src);
      return (importsNative && !permittedCore) || /from\s+["']vitest["']/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("pins security overrides for known transitive advisories", () => {
    const overrides = pkg.overrides ?? {};
    expect(overrides["lodash"]).toBeDefined();
    expect(overrides["@xmldom/xmldom"]).toBeDefined();
    expect(overrides["minimatch"]).toBeDefined();
    expect(overrides["nanoid"]).toBeDefined();
    expect(overrides["postcss"]).toBeDefined();
  });

  it("ships a bundle free of native packaging and test-runner modules", () => {
    const assets = join(root, "dist", "assets");
    if (!existsSync(assets)) return; // build artefacts are optional in CI
    const bundles = readdirSync(assets).filter((f) => f.endsWith(".js"));
    expect(bundles.length).toBeGreaterThan(0);
    for (const file of bundles) {
      const code = readFileSync(join(assets, file), "utf8");
      expect(code).not.toMatch(/@capacitor\/(cli|android|ios)/);
      expect(code).not.toMatch(/vitest\/dist/);
    }
  });
});
