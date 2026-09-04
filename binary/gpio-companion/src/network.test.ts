import { describe, expect, test } from "bun:test";
import {
	parseDefaultRoutes,
	parseWifiSsid,
	resolveNetworkStatus,
	splitNmcliLine,
} from "./network.ts";

describe("network status", () => {
	test("splits nmcli colon fields with escapes", () => {
		expect(splitNmcliLine("wlan0:wifi:connected:Home\\:SSID")).toEqual([
			"wlan0",
			"wifi",
			"connected",
			"Home:SSID",
		]);
	});

	test("prefers the default-route interface with the lowest metric", () => {
		expect(
			resolveNetworkStatus({
				devices:
					"eth0:ethernet:connected:Wired connection 1\nwlan0:wifi:connected:bench\nlo:loopback:connected:(unmanaged)\n",
				routes:
					"default via 192.168.1.1 dev eth0 proto dhcp metric 100\ndefault via 192.168.1.1 dev wlan0 proto dhcp metric 600\n",
				wifi: "yes:bench\n",
			}),
		).toEqual({
			type: "ethernet",
			ssid: "",
			interface: "eth0",
			connection: "Wired connection 1",
		});
	});

	test("uses wifi ssid when wifi is the primary route", () => {
		expect(
			resolveNetworkStatus({
				devices: "wlan0:wifi:connected:bench\n",
				routes: "default via 192.168.1.1 dev wlan0 proto dhcp metric 600\n",
				wifi: "yes:bench\n",
			}),
		).toEqual({
			type: "wifi",
			ssid: "bench",
			interface: "wlan0",
			connection: "bench",
		});
		expect(parseWifiSsid("no:other\nyes:Home:SSID\n")).toBe("Home:SSID");
		expect(
			parseDefaultRoutes(
				"default via 1.1.1.1 dev wlan0\ndefault via 1.1.1.1 dev eth0 metric 50\n",
			),
		).toEqual([
			{ device: "eth0", metric: 50 },
			{ device: "wlan0", metric: 10_000 },
		]);
	});
});
