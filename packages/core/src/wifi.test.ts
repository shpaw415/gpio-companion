import { describe, expect, test } from "bun:test";
import {
	classifyWifiConnectError,
	parseWifiConfig,
	publicWifiFailure,
	WifiConnectError,
	wifiConnectMessage,
} from "./wifi.ts";

describe("wifi", () => {
	test("parses ssid psk and pairing uuid", () => {
		expect(
			parseWifiConfig({
				ssid: " bench ",
				psk: " secret-pass ",
				uuid: " pair-uuid ",
			}),
		).toEqual({
			ssid: "bench",
			psk: "secret-pass",
			uuid: "pair-uuid",
		});
	});

	test("requires ssid", () => {
		expect(() => parseWifiConfig({ psk: "x", uuid: "u" })).toThrow("ssid");
	});
});

describe("classifyWifiConnectError", () => {
	test("ssid not found", () => {
		expect(
			classifyWifiConnectError("Error: No network with SSID 'lab' found."),
		).toBe("ssid-not-found");
		expect(
			classifyWifiConnectError("The Wi-Fi network could not be found"),
		).toBe("ssid-not-found");
		expect(classifyWifiConnectError("SSID bench not found")).toBe(
			"ssid-not-found",
		);
	});

	test("password", () => {
		expect(
			classifyWifiConnectError(
				"Error: Connection activation failed: (7) Secrets were required, but not provided.",
			),
		).toBe("password");
		expect(
			classifyWifiConnectError(
				"802-11-wireless-security.psk: property is invalid",
			),
		).toBe("password");
		expect(classifyWifiConnectError("wrong password")).toBe("password");
		expect(classifyWifiConnectError("bad password")).toBe("password");
	});

	test("no device", () => {
		expect(
			classifyWifiConnectError(
				"Error: No suitable device found for this connection.",
			),
		).toBe("no-device");
		expect(classifyWifiConnectError("Error: Device 'wlan0' not found.")).toBe(
			"no-device",
		);
		expect(classifyWifiConnectError("wifi is disabled")).toBe("no-device");
		expect(
			classifyWifiConnectError("Scanning not allowed while unavailable."),
		).toBe("no-device");
	});

	test("failed fallback", () => {
		expect(classifyWifiConnectError("Error: Timeout")).toBe("failed");
		expect(classifyWifiConnectError("")).toBe("failed");
	});
});

describe("WifiConnectError", () => {
	test("maps reason to a public message", () => {
		expect(wifiConnectMessage("ssid-not-found")).toBe("wifi network not found");
		expect(new WifiConnectError("password").message).toBe(
			"wifi password incorrect",
		);
		expect(publicWifiFailure("lab", "ssid-not-found")).toEqual({
			ssid: "lab",
			connected: false,
			reason: "ssid-not-found",
			error: "wifi network not found",
		});
	});
});
