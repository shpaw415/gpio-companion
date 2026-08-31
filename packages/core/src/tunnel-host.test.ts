import { describe, expect, test } from "bun:test";
import {
	cloudflareTunnelName,
	extractT3PairingUrl,
	pairingSlug,
	publicDeviceUrl,
	rewriteT3PairingUrl,
	tunnelHostnames,
} from "./tunnel-host.ts";

describe("tunnel hostnames", () => {
	test("strips uuid dashes for single-level dns labels", () => {
		const uuid = "550e8400-e29b-41d4-a716-446655440000";
		expect(pairingSlug(uuid)).toBe("550e8400e29b41d4a716446655440000");
		expect(tunnelHostnames(uuid)).toEqual({
			slug: "550e8400e29b41d4a716446655440000",
			t3Hostname: "t3-550e8400e29b41d4a716446655440000.gpio-companion.com",
			apiHostname: "api-550e8400e29b41d4a716446655440000.gpio-companion.com",
		});
		expect(cloudflareTunnelName(uuid)).toBe(`gpio-${uuid}`);
	});

	test("rewrites local pairing urls to hosted t3 pair links", () => {
		const url = rewriteT3PairingUrl(
			"http://127.0.0.1:3773/pair?token=abc123",
			"t3-abc.gpio-companion.com",
		);
		expect(url).toBe(
			"https://app.t3.codes/pair?host=https%3A%2F%2Ft3-abc.gpio-companion.com#token=abc123",
		);
	});

	test("extracts pairing urls from t3 start stdout", () => {
		const text = [
			"listening on 127.0.0.1:3773",
			"pair: https://app.t3.codes/pair?host=http://127.0.0.1:3773#token=xyz",
		].join("\n");
		expect(extractT3PairingUrl(text)).toContain("app.t3.codes/pair");
	});

	test("builds https device url", () => {
		expect(publicDeviceUrl("api-x.gpio-companion.com")).toBe(
			"https://api-x.gpio-companion.com",
		);
	});
});
