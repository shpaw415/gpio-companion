import { describe, expect, test } from "bun:test";
import {
	emptyDeviceConfig,
	parseDeviceConfig,
	parseTunnelConfig,
	redactDeviceConfig,
} from "./config.ts";

describe("device config", () => {
	test("empty raspberrypi config", () => {
		expect(emptyDeviceConfig("raspberrypi")).toEqual({
			hardware: "raspberrypi",
			tunnel: { token: "", hostname: "" },
		});
	});

	test("parses tunnel endpoint", () => {
		expect(
			parseTunnelConfig({
				token: " tok ",
				hostname: " t3.example.com ",
			}),
		).toEqual({
			token: "tok",
			hostname: "t3.example.com",
		});
	});

	test("parses full device config", () => {
		const config = parseDeviceConfig({
			hardware: "orangepi",
			tunnel: { token: "abc", hostname: "pi.example.com" },
		});
		expect(config.hardware).toBe("orangepi");
		expect(redactDeviceConfig(config).tunnel.token).toBe("***");
	});

	test("rejects unknown hardware", () => {
		expect(() =>
			parseDeviceConfig({
				hardware: "esp32",
				tunnel: { token: "", hostname: "" },
			}),
		).toThrow("hardware");
	});
});
