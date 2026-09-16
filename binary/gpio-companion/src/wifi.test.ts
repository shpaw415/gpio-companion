import { describe, expect, test } from "bun:test";
import {
	BLE_HEALTH_WIFI_PSK,
	BLE_HEALTH_WIFI_SSID,
	WifiConnectError,
} from "gpio-companion";
import { applyNetworkManagerWifi, type PrivilegedRun } from "./wifi.ts";

function recordRun(handler?: PrivilegedRun): {
	calls: string[][];
	run: PrivilegedRun;
} {
	const calls: string[][] = [];
	return {
		calls,
		run: async (cmd) => {
			calls.push(cmd);
			if (handler) {
				return handler(cmd);
			}
			return { stdout: "", stderr: "", code: 0 };
		},
	};
}

describe("applyNetworkManagerWifi", () => {
	test("probe ssid does not run nmcli connect", async () => {
		const { calls, run } = recordRun();
		const apply = applyNetworkManagerWifi(run);
		try {
			await apply({
				ssid: BLE_HEALTH_WIFI_SSID,
				psk: BLE_HEALTH_WIFI_PSK,
				uuid: "pair-uuid",
			});
			throw new Error("expected probe ssid to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(WifiConnectError);
			expect((error as WifiConnectError).reason).toBe("ssid-not-found");
		}
		expect(calls).toEqual([]);
	});

	test("persists autoconnect and powersave without bouncing managed wifi", async () => {
		const { calls, run } = recordRun(async (cmd) => {
			if (cmd.includes("status")) {
				return {
					stdout: "wlan0:wifi:disconnected\n",
					stderr: "",
					code: 0,
				};
			}
			if (cmd.includes("show")) {
				return {
					stdout: "bench:802-11-wireless:wlan0\n",
					stderr: "",
					code: 0,
				};
			}
			return { stdout: "", stderr: "", code: 0 };
		});
		const apply = applyNetworkManagerWifi(run);
		const result = await apply({
			ssid: "bench",
			psk: "secret-pass",
			uuid: "pair-uuid",
		});
		expect(result).toEqual({ ssid: "bench" });
		expect(
			calls.some(
				(cmd) =>
					cmd.includes("device") &&
					cmd.includes("wifi") &&
					cmd.includes("connect") &&
					cmd.includes("bench"),
			),
		).toBe(true);
		expect(calls.some((cmd) => cmd[0] === "ip")).toBe(false);
		expect(
			calls.some(
				(cmd) =>
					cmd.includes("connection") &&
					cmd.includes("modify") &&
					cmd.includes("bench") &&
					cmd.includes("connection.autoconnect-retries") &&
					cmd.includes("-1") &&
					cmd.includes("802-11-wireless.powersave") &&
					cmd.includes("2"),
			),
		).toBe(true);
	});

	test("claims unmanaged wifi without ip link bounce", async () => {
		const { calls, run } = recordRun(async (cmd) => {
			if (cmd.includes("status")) {
				return {
					stdout: "wlan0:wifi:unmanaged\n",
					stderr: "",
					code: 0,
				};
			}
			if (cmd.includes("connect")) {
				return { stdout: "", stderr: "", code: 0 };
			}
			if (cmd.includes("show")) {
				return {
					stdout: "lab:802-11-wireless:wlan0\n",
					stderr: "",
					code: 0,
				};
			}
			return { stdout: "", stderr: "", code: 0 };
		});
		await applyNetworkManagerWifi(run)({
			ssid: "lab",
			psk: "secret-pass",
			uuid: "pair-uuid",
		});
		expect(
			calls.some(
				(cmd) =>
					cmd.includes("device") &&
					cmd.includes("set") &&
					cmd.includes("wlan0") &&
					cmd.includes("managed"),
			),
		).toBe(true);
		expect(calls.some((cmd) => cmd[0] === "ip")).toBe(false);
	});
});
