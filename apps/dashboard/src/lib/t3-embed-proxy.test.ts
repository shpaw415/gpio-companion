import { describe, expect, test } from "bun:test";
import {
	embedPrefixFor,
	filterDownstreamHeaders,
	filterUpstreamRequestHeaders,
} from "./t3-embed-proxy.ts";

describe("t3 embed proxy headers", () => {
	test("drops hop-by-hop and cookie from the upstream request", () => {
		const source = new Headers({
			cookie: "access_token=secret",
			host: "gpio-companion.com",
			accept: "text/html",
			"cf-ray": "abc",
		});
		const headers = filterUpstreamRequestHeaders(
			source,
			"https://t3-abc.gpio-companion.com",
		);
		expect(headers.get("cookie")).toBeNull();
		expect(headers.get("cf-ray")).toBeNull();
		expect(headers.get("accept")).toBe("text/html");
		expect(headers.get("host")).toBe("t3-abc.gpio-companion.com");
		expect(headers.get("origin")).toBe("https://t3-abc.gpio-companion.com");
	});

	test("keeps websocket upgrade headers", () => {
		const source = new Headers({
			connection: "Upgrade",
			upgrade: "websocket",
			"sec-websocket-key": "x",
		});
		const headers = filterUpstreamRequestHeaders(
			source,
			"https://t3-abc.gpio-companion.com",
		);
		expect(headers.get("upgrade")).toBe("websocket");
		expect(headers.get("connection")).toBe("Upgrade");
		expect(headers.get("sec-websocket-key")).toBe("x");
	});

	test("strips frame-blocking headers and rewrites location", () => {
		const source = new Headers({
			"x-frame-options": "DENY",
			"content-security-policy": "frame-ancestors 'none'",
			location: "https://t3-abc.gpio-companion.com/pair",
		});
		const headers = filterDownstreamHeaders(
			source,
			"https://t3-abc.gpio-companion.com",
			"https://gpio-companion.com",
			embedPrefixFor("abc"),
		);
		expect(headers.get("x-frame-options")).toBeNull();
		expect(headers.get("content-security-policy")).toBe(
			"frame-ancestors 'self' http://tauri.localhost https://tauri.localhost http://localhost:1420 http://127.0.0.1:1420",
		);
		expect(headers.get("location")).toBe("/api/t3-embed/abc/pair");
	});
});
