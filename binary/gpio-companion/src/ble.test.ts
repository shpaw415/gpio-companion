import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	bleScriptCandidates,
	FALLBACK_BLE_SCRIPT,
	INSTALLED_BLE_SCRIPT,
	resolveBleScriptPath,
} from "./ble.ts";

describe("ble script path", () => {
	test("prefers env over the installed copy", () => {
		expect(
			resolveBleScriptPath({
				env: { GPIO_COMPANION_BLE_SCRIPT: "/tmp/custom.py" },
				exists: (path) =>
					path === "/tmp/custom.py" || path === INSTALLED_BLE_SCRIPT,
				readRepoPath: () => "/opt/gpio-companion",
				sourceDir: null,
			}),
		).toBe("/tmp/custom.py");
	});

	test("skips a missing env path and uses the installed copy", () => {
		expect(
			resolveBleScriptPath({
				env: { GPIO_COMPANION_BLE_SCRIPT: "/missing.py" },
				exists: (path) => path === INSTALLED_BLE_SCRIPT,
				readRepoPath: () => null,
				sourceDir: null,
			}),
		).toBe(INSTALLED_BLE_SCRIPT);
	});

	test("uses repo.path when the installed copy is missing", () => {
		const fromRepo = join(
			"/home/pi/gpio-companion",
			"scripts/ble-gatt-server.py",
		);
		expect(
			resolveBleScriptPath({
				env: {},
				exists: (path) => path === fromRepo,
				readRepoPath: () => "/home/pi/gpio-companion",
				sourceDir: null,
			}),
		).toBe(fromRepo);
	});

	test("falls back to /opt then the source tree", () => {
		const fromSource = join(
			"/src/binary/gpio-companion/src",
			"../../../scripts/ble-gatt-server.py",
		);
		expect(
			resolveBleScriptPath({
				env: {},
				exists: (path) => path === FALLBACK_BLE_SCRIPT,
				readRepoPath: () => null,
				sourceDir: "/src/binary/gpio-companion/src",
			}),
		).toBe(FALLBACK_BLE_SCRIPT);
		expect(
			resolveBleScriptPath({
				env: {},
				exists: (path) => path === fromSource,
				readRepoPath: () => null,
				sourceDir: "/src/binary/gpio-companion/src",
			}),
		).toBe(fromSource);
	});

	test("returns null when nothing exists", () => {
		expect(
			resolveBleScriptPath({
				env: {},
				exists: () => false,
				readRepoPath: () => "/opt/gpio-companion",
				sourceDir: "/src",
			}),
		).toBeNull();
	});

	test("candidate order is env, lib, repo, /opt, source", () => {
		expect(
			bleScriptCandidates({
				env: {
					GPIO_COMPANION_BLE_SCRIPT: "/tmp/custom.py",
					GPIO_COMPANION_LIB_DIR: "/opt/lib/gpio",
				},
				readRepoPath: () => "/home/pi/gpio-companion",
				sourceDir: "/src/binary/gpio-companion/src",
			}),
		).toEqual([
			"/tmp/custom.py",
			"/opt/lib/gpio/ble-gatt-server.py",
			"/home/pi/gpio-companion/scripts/ble-gatt-server.py",
			FALLBACK_BLE_SCRIPT,
			join(
				"/src/binary/gpio-companion/src",
				"../../../scripts/ble-gatt-server.py",
			),
		]);
	});
});
