import { describe, expect, test } from "bun:test";
import {
	isT3Path,
	parseT3EmbedPath,
	pickT3DeviceUuid,
	rewriteT3EmbedUrl,
	t3AppUrl,
	t3EmbedUrl,
	t3IframeSrc,
} from "./t3-url.ts";

describe("t3 app url", () => {
	test("builds the tunnel origin from a pairing uuid", () => {
		expect(t3AppUrl("550e8400-e29b-41d4-a716-446655440000")).toBe(
			"https://t3-550e8400e29b41d4a716446655440000.gpio-companion.com",
		);
	});

	test("returns empty for a blank uuid", () => {
		expect(t3AppUrl("  ")).toBe("");
	});

	test("iframe src is the pair page when a token is present", () => {
		expect(t3IframeSrc("550e8400-e29b-41d4-a716-446655440000")).toBe(
			"https://t3-550e8400e29b41d4a716446655440000.gpio-companion.com",
		);
		expect(t3IframeSrc("550e8400-e29b-41d4-a716-446655440000", "abc123")).toBe(
			"https://t3-550e8400e29b41d4a716446655440000.gpio-companion.com/pair#token=abc123",
		);
	});

	test("builds a same-origin dashboard proxy path", () => {
		expect(t3EmbedUrl("550e8400-e29b-41d4-a716-446655440000")).toBe(
			"/api/t3-embed/550e8400-e29b-41d4-a716-446655440000/",
		);
	});
});

describe("t3 embed path", () => {
	test("parses uuid and rest", () => {
		expect(
			parseT3EmbedPath(
				"/api/t3-embed/550e8400-e29b-41d4-a716-446655440000/pair",
			),
		).toEqual({
			uuid: "550e8400-e29b-41d4-a716-446655440000",
			rest: "/pair",
		});
		expect(
			parseT3EmbedPath("/api/t3-embed/550e8400-e29b-41d4-a716-446655440000"),
		).toEqual({
			uuid: "550e8400-e29b-41d4-a716-446655440000",
			rest: "/",
		});
	});

	test("rejects missing uuid", () => {
		expect(parseT3EmbedPath("/api/t3-embed/")).toBeNull();
		expect(parseT3EmbedPath("/devices/t3")).toBeNull();
	});
});

describe("rewriteT3EmbedUrl", () => {
	const t3 = "https://t3-abc.gpio-companion.com";
	const embed = "https://gpio-companion.com";
	const prefix = "/api/t3-embed/abc";

	test("prefixes root-relative and t3-origin urls", () => {
		expect(rewriteT3EmbedUrl("/assets/app.js", t3, embed, prefix)).toBe(
			"/api/t3-embed/abc/assets/app.js",
		);
		expect(rewriteT3EmbedUrl(`${t3}/pair#token=1`, t3, embed, prefix)).toBe(
			"/api/t3-embed/abc/pair#token=1",
		);
	});

	test("leaves foreign and fragment urls", () => {
		expect(rewriteT3EmbedUrl("#main", t3, embed, prefix)).toBe("#main");
		expect(rewriteT3EmbedUrl("https://example.com/x", t3, embed, prefix)).toBe(
			"https://example.com/x",
		);
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
