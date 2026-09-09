import { describe, expect, test } from "bun:test";
import {
	DEBUG_EVENT_PATH,
	DEBUG_LIVE_TTL_SEC,
	DEBUG_PATH,
	DEBUG_VIA_HEADER,
	DEFAULT_DASHBOARD_ORIGIN,
	debugAuthHeadersFromRequest,
	debugAuthHeadersFromSearch,
	debugAuthQuery,
	debugLevelFromStatus,
	debugProbeMessage,
	debugViaFromRequest,
	debugWsConnectUrl,
	debugWsUrl,
	formatDebugLogLine,
	isAllowedDebugOrigin,
	isLiveSeen,
	liveDeviceUrl,
	normalizeDebugPath,
	parseDebugEvent,
	parseDebugEventInput,
	parseDebugProbe,
	parseLivePingUuid,
	redactDebugMessage,
	shouldPublishDebugPath,
} from "./debug.ts";

describe("debug helpers", () => {
	test("maps status to error or warning", () => {
		expect(debugLevelFromStatus(200)).toBeNull();
		expect(debugLevelFromStatus(400)).toBe("warning");
		expect(debugLevelFromStatus(401)).toBe("warning");
		expect(debugLevelFromStatus(404)).toBe("warning");
		expect(debugLevelFromStatus(500)).toBe("error");
		expect(debugLevelFromStatus(200, { via: "ble" })).toBe("info");
		expect(debugLevelFromStatus(204, { via: "ble" })).toBe("info");
		expect(debugLevelFromStatus(400, { via: "ble" })).toBe("warning");
		expect(debugLevelFromStatus(504, { via: "ble" })).toBe("error");
	});

	test("skips health and debug paths", () => {
		expect(shouldPublishDebugPath("/health")).toBe(false);
		expect(shouldPublishDebugPath("/v1/debug")).toBe(false);
		expect(shouldPublishDebugPath("/v1/debug/ticket")).toBe(false);
		expect(shouldPublishDebugPath(DEBUG_EVENT_PATH)).toBe(false);
		expect(shouldPublishDebugPath("/v1/status")).toBe(true);
		expect(shouldPublishDebugPath("/v1/config/wifi")).toBe(true);
	});

	test("strips trailing slash and query from paths", () => {
		expect(normalizeDebugPath("/v1/debug/")).toBe(DEBUG_PATH);
		expect(normalizeDebugPath("/v1/status?x=1")).toBe("/v1/status");
	});

	test("redacts token-like values", () => {
		expect(redactDebugMessage("token ghs_abcDEF123")).toBe("token [redacted]");
		expect(redactDebugMessage("wifi network not found")).toBe(
			"wifi network not found",
		);
	});

	test("allows dashboard and loopback origins", () => {
		expect(isAllowedDebugOrigin("")).toBe(true);
		expect(isAllowedDebugOrigin("null")).toBe(true);
		expect(isAllowedDebugOrigin("http://localhost:3010")).toBe(true);
		expect(isAllowedDebugOrigin("http://127.0.0.1:8787")).toBe(true);
		expect(isAllowedDebugOrigin(DEFAULT_DASHBOARD_ORIGIN)).toBe(true);
		expect(isAllowedDebugOrigin("https://evil.example")).toBe(false);
		expect(
			isAllowedDebugOrigin(
				"https://preview.example",
				"https://preview.example",
			),
		).toBe(true);
	});

	test("allows native app websocket origins", () => {
		expect(isAllowedDebugOrigin("https://api-abc.gpio-companion.com")).toBe(
			true,
		);
		expect(isAllowedDebugOrigin("https://tauri.localhost")).toBe(true);
		expect(isAllowedDebugOrigin("http://tauri.localhost:1420")).toBe(true);
		expect(isAllowedDebugOrigin("gpio-companion://")).toBe(true);
		expect(isAllowedDebugOrigin("gpio-companion-desktop://auth/callback")).toBe(
			true,
		);
	});

	test("builds websocket url from device url", () => {
		expect(debugWsUrl("https://api-abc.gpio-companion.com")).toBe(
			"wss://api-abc.gpio-companion.com/v1/debug",
		);
		expect(debugWsUrl("http://127.0.0.1:4150/")).toBe(
			"ws://127.0.0.1:4150/v1/debug",
		);
	});

	test("puts signed timestamped headers on the websocket url", () => {
		const headers = {
			"X-Gpio-Key-Id": "gpio-companion-v1",
			"X-Gpio-Timestamp": "1700000000000",
			"X-Gpio-Nonce": "abc",
			"X-Gpio-Signature": "c2ln",
		};
		const url = debugWsConnectUrl(
			"https://api-abc.gpio-companion.com",
			headers,
		);
		expect(url.startsWith("wss://api-abc.gpio-companion.com/v1/debug?")).toBe(
			true,
		);
		expect(debugAuthQuery(headers)).toContain("x-gpio-timestamp=1700000000000");
		const search = new URL(url).searchParams;
		expect(debugAuthHeadersFromSearch(search).get("x-gpio-key-id")).toBe(
			"gpio-companion-v1",
		);
		expect(debugAuthHeadersFromSearch(search).get("x-gpio-timestamp")).toBe(
			"1700000000000",
		);
	});

	test("fills debug auth from request headers when query is empty", () => {
		const request = new Request("https://api.example/v1/debug", {
			headers: {
				"x-gpio-key-id": "gpio-companion-v1",
				"x-gpio-timestamp": "1700000000000",
				"x-gpio-nonce": "abc",
				"x-gpio-signature": "c2ln",
			},
		});
		const headers = debugAuthHeadersFromRequest(request);
		expect(headers.get("x-gpio-key-id")).toBe("gpio-companion-v1");
		expect(headers.get("x-gpio-timestamp")).toBe("1700000000000");
	});

	test("parses handshake probe", () => {
		expect(parseDebugProbe(400, "upgrade failed")).toEqual({
			status: 400,
			error: "upgrade failed",
			ready: true,
		});
		expect(
			parseDebugProbe(401, '{"error":"missing device signature"}'),
		).toEqual({
			status: 401,
			error: "missing device signature",
			ready: false,
		});
		expect(parseDebugProbe(404, '{"error":"not found"}').ready).toBe(false);
		expect(
			debugProbeMessage(parseDebugProbe(404, '{"error":"not found"}')),
		).toContain("gpio-companion-update");
	});

	test("parses debug events", () => {
		expect(parseDebugEvent(null)).toBeNull();
		expect(
			parseDebugEvent({
				t: 1,
				level: "warning",
				method: "PUT",
				path: "/v1/config/wifi",
				status: 400,
				message: "wifi network not found",
			}),
		).toEqual({
			t: 1,
			level: "warning",
			method: "PUT",
			path: "/v1/config/wifi",
			status: 400,
			message: "wifi network not found",
		});
		expect(
			parseDebugEvent({
				t: 2,
				level: "info",
				method: "GET",
				path: "/v1/info",
				status: 200,
				message: "ok",
				via: "ble",
			}),
		).toEqual({
			t: 2,
			level: "info",
			method: "GET",
			path: "/v1/info",
			status: 200,
			message: "ok",
			via: "ble",
		});
	});

	test("reads ble via header and formats log lines", () => {
		expect(
			debugViaFromRequest(
				new Request("http://127.0.0.1/v1/info", {
					headers: { [DEBUG_VIA_HEADER]: "ble" },
				}),
			),
		).toBe("ble");
		expect(
			debugViaFromRequest(new Request("http://127.0.0.1/v1/info")),
		).toBeUndefined();
		expect(
			formatDebugLogLine({
				t: Date.parse("2026-09-09T00:00:00.000Z"),
				level: "info",
				method: "GET",
				path: "/v1/gpio",
				status: 200,
				message: "ok",
				via: "ble",
			}),
		).toBe("2026-09-09T00:00:00.000Z info ble 200 GET /v1/gpio ok");
	});

	test("parses loopback debug event ingest", () => {
		expect(
			parseDebugEventInput(
				{
					method: "get",
					path: "/v1/info",
					status: 401,
					message: "missing device signature",
					via: "ble",
				},
				1,
			),
		).toEqual({
			t: 1,
			level: "warning",
			method: "GET",
			path: "/v1/info",
			status: 401,
			message: "missing device signature",
			via: "ble",
		});
		expect(
			parseDebugEventInput(
				{
					method: "WRITE",
					path: "/ble/cmd",
					status: 400,
					message: "token ghs_abcDEF123",
					via: "ble",
				},
				2,
			).message,
		).toBe("token [redacted]");
		expect(() => parseDebugEventInput(null)).toThrow("debug event is required");
	});

	test("parses live ping uuid and derives the tunnel URL", () => {
		expect(() => parseLivePingUuid(null)).toThrow("uuid is required");
		expect(parseLivePingUuid({ uuid: "  abc-def  " })).toBe("abc-def");
		expect(liveDeviceUrl("abc-def")).toBe(
			"https://api-abcdef.gpio-companion.com",
		);
		expect(isLiveSeen(1_000, 1_000 + (DEBUG_LIVE_TTL_SEC - 1) * 1000)).toBe(
			true,
		);
		expect(isLiveSeen(1_000, 1_000 + (DEBUG_LIVE_TTL_SEC + 1) * 1000)).toBe(
			false,
		);
	});
});
