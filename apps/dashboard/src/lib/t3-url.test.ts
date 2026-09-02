import { describe, expect, test } from "bun:test";
import { isT3Path, pickT3DeviceUuid, t3AppUrl } from "./t3-url.ts";

describe("t3 app url", () => {
	test("builds the tunnel origin from a pairing uuid", () => {
		expect(t3AppUrl("550e8400-e29b-41d4-a716-446655440000")).toBe(
			"https://t3-550e8400e29b41d4a716446655440000.gpio-companion.com",
		);
	});

	test("returns empty for a blank uuid", () => {
		expect(t3AppUrl("  ")).toBe("");
	});
});

describe("t3 path", () => {
	test("matches the devices t3 tab", () => {
		expect(isT3Path("/devices/t3")).toBe(true);
		expect(isT3Path("/devices/t3/")).toBe(true);
		expect(isT3Path("/devices")).toBe(false);
		expect(isT3Path("/devices/pair")).toBe(false);
	});
});

describe("pickT3DeviceUuid", () => {
	const devices = [{ uuid: "aaa" }, { uuid: "bbb" }];

	test("keeps the preferred uuid when it is still owned", () => {
		expect(pickT3DeviceUuid(devices, "bbb")).toBe("bbb");
	});

	test("falls back to the first device", () => {
		expect(pickT3DeviceUuid(devices, "missing")).toBe("aaa");
		expect(pickT3DeviceUuid(devices, "")).toBe("aaa");
	});

	test("returns empty when there are no devices", () => {
		expect(pickT3DeviceUuid([], "aaa")).toBe("");
	});
});
