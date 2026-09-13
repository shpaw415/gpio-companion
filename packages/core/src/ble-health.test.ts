import { describe, expect, test } from "bun:test";
import {
	evaluateBleHealthCheck,
	formatBleHealthReport,
	parseBleHealthBody,
} from "./ble-health.ts";

describe("ble-health", () => {
	test("parses JSON status payloads", () => {
		expect(parseBleHealthBody('{"running":false}')).toEqual({ running: false });
		expect(parseBleHealthBody("not-json")).toEqual({
			error: "non-JSON status payload: not-json",
		});
	});

	test("passes GATT info when UUID matches", () => {
		const result = evaluateBleHealthCheck("gatt-info", {
			selectedUuid: "pair-uuid",
			body: { uuid: "pair-uuid", hardware: "orangepi", name: "gpio-companion" },
		});
		expect(result.pass).toBe(true);
	});

	test("fails GATT info on the wrong board", () => {
		const result = evaluateBleHealthCheck("gatt-info", {
			selectedUuid: "board-a",
			body: { uuid: "board-b" },
		});
		expect(result.pass).toBe(false);
		expect(result.detail).toContain("does not match");
	});

	test("passes truncated companion info over BLE MTU", () => {
		const result = evaluateBleHealthCheck("get-info", {
			body: parseBleHealthBody(
				'{"ble":{"adapter":"hci0"},"dashboardUrl":"https://gpio-companion.com","deviceAuth":{"keyId":"gpio-companion-v1"',
			),
		});
		expect(result.pass).toBe(true);
		expect(result.detail).toContain("truncated");
	});

	test("keeps the full non-JSON payload in the error", () => {
		const payload = `{"ble":${"x".repeat(300)}`;
		expect(parseBleHealthBody(payload)).toEqual({
			error: `non-JSON status payload: ${payload}`,
		});
	});

	test("passes truncated gpio snapshots over BLE MTU", () => {
		const result = evaluateBleHealthCheck("get-gpio", {
			body: parseBleHealthBody(
				'{"hardware":"orangepi","pins":[{"physical":1,"name":"3V3"',
			),
		});
		expect(result.pass).toBe(true);
		expect(result.detail).toContain("truncated");
	});

	test("treats power-pin refusal as a passing gpio write probe", () => {
		const result = evaluateBleHealthCheck("put-gpio-power", {
			error: "pin 1 is power, not gpio",
		});
		expect(result.pass).toBe(true);
		expect(result.detail).toContain("refused pin 1");
	});

	test("still fails gpio get when the leftover payload is companion info", () => {
		const result = evaluateBleHealthCheck("get-gpio", {
			body: parseBleHealthBody(
				'{"ble":{"adapter":"hci0"},"dashboardUrl":"https://gpio-companion.com"',
			),
		});
		expect(result.pass).toBe(false);
		expect(result.detail).toContain("non-JSON");
	});

	test("fails gpio write probe when the pin is accepted", () => {
		const result = evaluateBleHealthCheck("put-gpio-power", {
			body: { hardware: "orangepi", pins: [] },
		});
		expect(result.pass).toBe(false);
		expect(result.detail).toContain("should refuse");
	});

	test("passes wifi probe on ssid-not-found", () => {
		const result = evaluateBleHealthCheck("put-wifi", {
			body: {
				error: "wifi network not found",
				reason: "ssid-not-found",
				connected: false,
			},
		});
		expect(result.pass).toBe(true);
	});

	test("fails wifi probe if it connects", () => {
		const result = evaluateBleHealthCheck("put-wifi", {
			body: { ssid: "gpio-companion-ble-health-probe", connected: true },
		});
		expect(result.pass).toBe(false);
		expect(result.detail).toContain("unexpectedly connected");
	});

	test("passes serial console snapshot over GATT", () => {
		const result = evaluateBleHealthCheck("get-console", {
			body: {
				host: { running: false, log: "" },
				usb: { open: false, port: "", baud: 115200, log: "" },
			},
		});
		expect(result.pass).toBe(true);
	});

	test("passes host run status over GATT", () => {
		const result = evaluateBleHealthCheck("get-run", {
			body: { running: false, log: "", last: null },
		});
		expect(result.pass).toBe(true);
	});

	test("explains a missing run signer", () => {
		const result = evaluateBleHealthCheck("get-run", {
			error: "no signer for get-run",
		});
		expect(result.pass).toBe(false);
		expect(result.detail).toContain("Dashboard could not sign GET /v1/run");
	});

	test("explains a bluetooth timeout", () => {
		const result = evaluateBleHealthCheck("get-info", {
			error: "bluetooth timed out",
		});
		expect(result.pass).toBe(false);
		expect(result.detail).toContain("GATT status characteristic");
	});

	test("formats a report for clipboard", () => {
		expect(
			formatBleHealthReport([
				{ name: "READ GATT info", state: "pass" },
				{
					name: "GET /v1/info",
					state: "fail",
					log: "Timed out waiting for the GATT status characteristic.",
				},
			]),
		).toBe(
			"PASS  READ GATT info\nFAIL  GET /v1/info\n  Timed out waiting for the GATT status characteristic.",
		);
	});
});
