import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { FALLBACK_INFO_SCRIPT, resolveInfoScriptPath } from "./info.ts";

describe("info script path", () => {
	test("prefers env over repo.path", () => {
		expect(
			resolveInfoScriptPath({
				env: { GPIO_COMPANION_INFO_SCRIPT: "/tmp/info.sh" },
				exists: (path) =>
					path === "/tmp/info.sh" || path === FALLBACK_INFO_SCRIPT,
				readRepoPath: () => "/opt/gpio-companion",
				sourceDir: null,
			}),
		).toBe("/tmp/info.sh");
	});

	test("uses repo.path then /opt then the source tree", () => {
		const fromRepo = join("/home/pi/gpio-companion", "scripts/info.sh");
		expect(
			resolveInfoScriptPath({
				env: {},
				exists: (path) => path === fromRepo,
				readRepoPath: () => "/home/pi/gpio-companion",
				sourceDir: null,
			}),
		).toBe(fromRepo);
		expect(
			resolveInfoScriptPath({
				env: {},
				exists: (path) => path === FALLBACK_INFO_SCRIPT,
				readRepoPath: () => null,
				sourceDir: null,
			}),
		).toBe(FALLBACK_INFO_SCRIPT);
	});

	test("returns null when nothing exists", () => {
		expect(
			resolveInfoScriptPath({
				env: {},
				exists: () => false,
				readRepoPath: () => "/opt/gpio-companion",
				sourceDir: "/src",
			}),
		).toBeNull();
	});
});
