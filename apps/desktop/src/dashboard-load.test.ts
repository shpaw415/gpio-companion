import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import viteConfig from "../vite.config.ts";

const desktopRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const srcRoot = path.join(desktopRoot, "src");

function walkSource(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkSource(full));
			continue;
		}
		if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
			continue;
		}
		if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
			files.push(full);
		}
	}
	return files;
}

function namedValueImports(source: string): string[] {
	const names: string[] = [];
	const pattern =
		/import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']gpio-companion["']/g;
	for (const match of source.matchAll(pattern)) {
		if (match[1]) {
			continue;
		}
		for (const raw of match[2].split(",")) {
			const part = raw.trim();
			if (!part || part.startsWith("type ")) {
				continue;
			}
			const name = part.split(/\s+as\s+/)[0]?.trim();
			if (name) {
				names.push(name);
			}
		}
	}
	return names;
}

function gpioCompanionAlias(): string {
	const alias = viteConfig.resolve?.alias;
	if (!alias || Array.isArray(alias) || typeof alias === "string") {
		throw new Error("vite gpio-companion alias missing");
	}
	const target = (alias as Record<string, string>)["gpio-companion"];
	if (!target) {
		throw new Error("vite gpio-companion alias missing");
	}
	return path.resolve(target);
}

describe("desktop dashboard load", () => {
	test("vite gpio-companion alias exports every named import", async () => {
		const aliasPath = gpioCompanionAlias();
		const tsconfig = JSON.parse(
			readFileSync(path.join(desktopRoot, "tsconfig.json"), "utf8"),
		) as { compilerOptions?: { paths?: Record<string, string[]> } };
		const tsAlias = tsconfig.compilerOptions?.paths?.["gpio-companion"]?.[0];
		expect(tsAlias).toBeTruthy();
		expect(path.resolve(desktopRoot, tsAlias ?? "")).toBe(aliasPath);

		const names = [
			...new Set(
				walkSource(srcRoot).flatMap((file) =>
					namedValueImports(readFileSync(file, "utf8")),
				),
			),
		];
		expect(names).toContain("isHardwareId");
		expect(names).toContain("headerPinsForBoard");

		const aliased = await import(pathToFileURL(aliasPath).href);
		const missing = names.filter((name) => !(name in aliased));
		expect(missing).toEqual([]);
	});
});
