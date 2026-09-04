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
 * - the shipped bundle must not contain Capacitor or test-runner code
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

  it("does not import Capacitor or vitest from application source", () => {
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
      return /from\s+["']@capacitor\//.test(src) || /from\s+["']vitest["']/.test(src);
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

  it("ships a bundle free of Capacitor and test-runner modules", () => {
    const assets = join(root, "dist", "assets");
    if (!existsSync(assets)) return; // build artefacts are optional in CI
    const bundles = readdirSync(assets).filter((f) => f.endsWith(".js"));
    expect(bundles.length).toBeGreaterThan(0);
    for (const file of bundles) {
      const code = readFileSync(join(assets, file), "utf8");
      expect(code).not.toMatch(/@capacitor\//);
      expect(code).not.toMatch(/vitest\/dist/);
    }
  });
});
