import { describe, expect, test } from "bun:test";
import {
	ANDROID_HOTSPOT_INTENTS,
	HOTSPOT_SETTINGS_FAILED,
	openAndroidHotspotSettings,
} from "./hotspot-settings.ts";

describe("ANDROID_HOTSPOT_INTENTS", () => {
	test("tries wifi tether, then tethering, then wireless", () => {
		expect([...ANDROID_HOTSPOT_INTENTS]).toEqual([
			"android.settings.WIFI_TETHER_SETTINGS",
			"android.settings.TETHER_SETTINGS",
			"android.settings.WIRELESS_SETTINGS",
		]);
	});
});

describe("openAndroidHotspotSettings", () => {
	test("stops at the first intent that opens", async () => {
		const tried: string[] = [];
		await openAndroidHotspotSettings(async (action) => {
			tried.push(action);
			if (action !== "android.settings.TETHER_SETTINGS") {
				throw new Error("missing");
			}
		});
		expect(tried).toEqual([
			"android.settings.WIFI_TETHER_SETTINGS",
			"android.settings.TETHER_SETTINGS",
		]);
	});

	test("throws the last error when none open", async () => {
		await expect(
			openAndroidHotspotSettings(async () => {
				throw new Error("no activity");
			}),
		).rejects.toThrow("no activity");
	});

	test("throws a wire error when the last failure is not an Error", async () => {
		await expect(
			openAndroidHotspotSettings(async () => {
				throw "nope";
			}),
		).rejects.toThrow(HOTSPOT_SETTINGS_FAILED);
	});
});
