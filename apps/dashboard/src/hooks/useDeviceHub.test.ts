import { describe, expect, test } from "bun:test";
import { HUB_PATH } from "gpio-companion";
import { hubBrowserUrl } from "./useDeviceHub.ts";

describe("hubBrowserUrl", () => {
	test("uses wss on https pages", () => {
		expect(
			hubBrowserUrl("abc-def", {
				protocol: "https:",
				host: "gpio-companion.com",
			} as Location),
		).toBe(`wss://gpio-companion.com${HUB_PATH}?uuid=abc-def`);
	});

	test("uses ws on http pages", () => {
		expect(
			hubBrowserUrl("abc-def", {
				protocol: "http:",
				host: "localhost:3010",
			} as Location),
		).toBe(`ws://localhost:3010${HUB_PATH}?uuid=abc-def`);
	});
});
