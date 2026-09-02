import { describe, expect, test } from "bun:test";
import {
	DEBUG_PATH,
	DEFAULT_DASHBOARD_ORIGIN,
	debugLevelFromStatus,
	debugWsUrl,
	isAllowedDebugOrigin,
	normalizeDebugPath,
	parseDebugEvent,
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
	});

	test("skips health and debug paths", () => {
		expect(shouldPublishDebugPath("/health")).toBe(false);
		expect(shouldPublishDebugPath("/v1/debug")).toBe(false);
		expect(shouldPublishDebugPath("/v1/debug/ticket")).toBe(false);
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

	test("builds websocket url from device url", () => {
		expect(debugWsUrl("https://api-abc.gpio-companion.com")).toBe(
			"wss://api-abc.gpio-companion.com/v1/debug",
		);
		expect(debugWsUrl("http://127.0.0.1:4150/")).toBe(
			"ws://127.0.0.1:4150/v1/debug",
		);
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
	});
});
