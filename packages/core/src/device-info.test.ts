import { describe, expect, test } from "bun:test";
import {
	flattenDeviceInfo,
	formatNetworkLabel,
	parseNetworkStatus,
} from "./device-info.ts";

describe("device info", () => {
	test("parses and labels network status", () => {
		expect(parseNetworkStatus(null)).toBeNull();
		expect(parseNetworkStatus({ type: "ppp" })).toBeNull();
		expect(
			parseNetworkStatus({
				type: "wifi",
				ssid: "bench",
				interface: "wlan0",
				connection: "bench",
			}),
		).toEqual({
			type: "wifi",
			ssid: "bench",
			interface: "wlan0",
			connection: "bench",
		});
		expect(
			formatNetworkLabel({
				type: "ethernet",
				ssid: "",
				interface: "eth0",
				connection: "Wired",
			}),
		).toBe("Ethernet");
		expect(
			formatNetworkLabel({
				type: "wifi",
				ssid: "bench",
				interface: "wlan0",
				connection: "bench",
			}),
		).toBe("WiFi · bench");
		expect(
			formatNetworkLabel({
				type: "wifi",
				ssid: "",
				interface: "wlan0",
				connection: "",
			}),
		).toBe("WiFi");
		expect(
			formatNetworkLabel({
				type: "unknown",
				ssid: "",
				interface: "",
				connection: "",
			}),
		).toBe("");
	});

	test("flattens companion info json", () => {
		expect(
			flattenDeviceInfo({
				host: { hostname: "orangepi", ntpSynchronized: true },
				network: { type: "ethernet", ssid: "" },
			}),
		).toEqual([
			{ key: "host.hostname", value: "orangepi" },
			{ key: "host.ntpSynchronized", value: "yes" },
			{ key: "network.type", value: "ethernet" },
			{ key: "network.ssid", value: "-" },
		]);
	});
});
