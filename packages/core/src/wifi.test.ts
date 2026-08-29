import { describe, expect, test } from "bun:test";
import { parseWifiConfig } from "./wifi.ts";

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
