import { describe, expect, test } from "bun:test";
import {
	DEVICE_TABS_EASY,
	deviceTabs,
	isAllowedDeviceTab,
	parseDashboardMode,
} from "./dashboard-mode.ts";

describe("parseDashboardMode", () => {
	test("defaults to easy", () => {
		expect(parseDashboardMode(undefined)).toBe("easy");
		expect(parseDashboardMode(null)).toBe("easy");
		expect(parseDashboardMode("easy")).toBe("easy");
		expect(parseDashboardMode("nope")).toBe("easy");
	});

	test("accepts expert", () => {
		expect(parseDashboardMode("expert")).toBe("expert");
	});
});

describe("deviceTabs", () => {
	test("easy hides pair requests debug admin", () => {
		const ids = deviceTabs("easy", true).map((tab) => tab.id);
		expect(ids).toEqual(DEVICE_TABS_EASY.map((tab) => tab.id));
		expect(ids).not.toContain("pair");
		expect(ids).not.toContain("debug");
		expect(ids).not.toContain("admin");
		expect(ids).toContain("wifi");
	});

	test("expert adds admin only for admins", () => {
		expect(deviceTabs("expert", false).map((tab) => tab.id)).not.toContain(
			"admin",
		);
		expect(deviceTabs("expert", true).map((tab) => tab.id)).toContain("admin");
	});
});

describe("isAllowedDeviceTab", () => {
	test("easy can open pair from My board", () => {
		expect(isAllowedDeviceTab("easy", false, "pair")).toBe(true);
		expect(isAllowedDeviceTab("easy", false, "overview")).toBe(true);
		expect(isAllowedDeviceTab("easy", false, "wifi")).toBe(true);
		expect(isAllowedDeviceTab("easy", true, "debug")).toBe(false);
		expect(isAllowedDeviceTab("easy", true, "admin")).toBe(false);
	});
});
