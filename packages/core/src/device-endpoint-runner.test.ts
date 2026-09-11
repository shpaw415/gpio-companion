import { describe, expect, test } from "bun:test";
import {
	deviceEndpointProbes,
	evaluateDeviceEndpointProbe,
	parseDeviceEndpointBody,
} from "./device-endpoint-runner.ts";
import { pairingUuidFromDeviceUrl } from "./tunnel-host.ts";

describe("device-endpoint-runner", () => {
	test("covers every Pi HTTP route plus offline grant variants", () => {
		const probes = deviceEndpointProbes();
		const names = probes.map((item) => item.name);
		for (const required of [
			"GET /health",
			"GET /v1/status",
			"GET /v1/pairing",
			"GET /v1/pairing/credentials",
			"POST /v1/pairing/claim",
			"POST /v1/pairing/transfer",
			"POST /v1/pairing/unpair",
			"GET /v1/config",
			"PUT /v1/config",
			"PUT /v1/config/tunnel",
			"GET /v1/config/ai-key",
			"GET /v1/config/secrets",
			"PUT /v1/config/secrets",
			"PUT /v1/config/wifi",
			"PUT /v1/config/github",
			"GET /v1/t3/status",
			"GET /v1/logs",
			"GET /v1/info",
			"GET /v1/gpio",
			"PUT /v1/gpio",
			"GET /v1/flash",
			"GET /v1/flash/ports",
			"POST /v1/flash",
			"GET /v1/debug",
			"POST /v1/debug/event",
			"GET /v1/github-token",
			"POST /v1/projects/sync",
			"GET /v1/ai",
			"offline GET /v1/info",
			"offline GET /v1/gpio",
			"offline PUT /v1/gpio",
			"offline GET /v1/flash",
			"offline GET /v1/flash/ports",
			"offline PUT /v1/config/wifi",
			"offline deny GET /v1/status",
			"offline deny POST /v1/update",
			"offline deny POST /v1/projects/sync",
			"offline deny POST /v1/t3/pair",
		]) {
			expect(names).toContain(required);
		}
		expect(probes.some((item) => item.auth === "offline")).toBe(true);
		expect(probes.some((item) => item.auth === "offline-deny")).toBe(true);
	});

	test("prefers full JSON over truncated BLE heuristics", () => {
		const gpio = deviceEndpointProbes().find((item) => item.id === "get-gpio");
		if (!gpio) {
			throw new Error("missing gpio probe");
		}
		const result = evaluateDeviceEndpointProbe(gpio, {
			body: { hardware: "orangepi", pins: [{ physical: 1 }] },
			raw: '{"hardware":"orangepi","pins":[{"physical":1}]}',
		});
		expect(result.pass).toBe(true);
		expect(result.detail).toContain("JSON ok");
	});

	test("passes wifi probe and gpio power refusal", () => {
		const probes = deviceEndpointProbes();
		const wifi = probes.find((item) => item.id === "put-wifi");
		const gpio = probes.find((item) => item.id === "put-gpio-power");
		if (!wifi || !gpio) {
			throw new Error("missing probes");
		}
		expect(
			evaluateDeviceEndpointProbe(wifi, {
				body: parseDeviceEndpointBody(
					'{"error":"wifi network not found","reason":"ssid-not-found"}',
				),
				status: 400,
			}).pass,
		).toBe(true);
		expect(
			evaluateDeviceEndpointProbe(gpio, {
				error: "pin 1 is power, not gpio",
				status: 400,
			}).pass,
		).toBe(true);
	});

	test("passes local-only and debug HTTP probes", () => {
		const probes = deviceEndpointProbes();
		const creds = probes.find((item) => item.id === "get-pairing-credentials");
		const debug = probes.find((item) => item.id === "get-debug-http");
		if (!creds || !debug) {
			throw new Error("missing probes");
		}
		expect(
			evaluateDeviceEndpointProbe(creds, {
				status: 403,
				body: { error: "pairing credentials are local-only" },
			}).pass,
		).toBe(true);
		expect(
			evaluateDeviceEndpointProbe(debug, {
				status: 400,
				raw: "upgrade failed",
			}).pass,
		).toBe(true);
	});

	test("rejects an offline-deny miss", () => {
		const deny = deviceEndpointProbes().find(
			(item) => item.id === "offline-deny-get-status",
		);
		if (!deny) {
			throw new Error("missing deny probe");
		}
		expect(
			evaluateDeviceEndpointProbe(deny, {
				status: 200,
				body: { hardware: "orangepi" },
			}).pass,
		).toBe(false);
		expect(
			evaluateDeviceEndpointProbe(deny, {
				status: 403,
				body: { error: "offline grant scope mismatch" },
			}).pass,
		).toBe(true);
	});

	test("round-trips the live tunnel hostname to a pairing uuid", () => {
		expect(
			pairingUuidFromDeviceUrl(
				"https://api-cfd5f269a3f64b19b1bd45a60adb882c.gpio-companion.com/",
			),
		).toBe("cfd5f269-a3f6-4b19-b1bd-45a60adb882c");
	});
});
