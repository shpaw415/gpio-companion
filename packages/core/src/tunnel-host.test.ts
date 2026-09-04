import { describe, expect, test } from "bun:test";
import {
	cloudflareTunnelName,
	dashboardT3PairPath,
	dashboardT3PairUrl,
	extractT3PairingToken,
	extractT3PairingUrl,
	pairingSlug,
	parseDashboardT3PairLocation,
	publicDeviceUrl,
	rewriteT3PairingUrl,
	t3PairPageUrl,
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

	test("rewrites local pairing urls to the device tunnel pair link", () => {
		const url = rewriteT3PairingUrl(
			"http://127.0.0.1:3773/pair?token=abc123",
			"t3-abc.gpio-companion.com",
		);
		expect(url).toBe("https://t3-abc.gpio-companion.com/pair#token=abc123");
		expect(url).not.toContain("app.t3.codes");
	});

	test("extracts pairing urls from t3 pair stdout, not the connection string", () => {
		const text = [
			"T3 Code server is ready.",
			"Connection string: http://127.0.0.1:3773",
			"Token: xyz",
			"Pairing URL: http://127.0.0.1:3773/pair#token=xyz",
		].join("\n");
		expect(extractT3PairingUrl(text)).toBe(
			"http://127.0.0.1:3773/pair#token=xyz",
		);
		expect(extractT3PairingToken(text)).toBe("xyz");
		expect(rewriteT3PairingUrl(text, "t3-abc.gpio-companion.com")).toBe(
			"https://t3-abc.gpio-companion.com/pair#token=xyz",
		);
	});

	test("extracts token from pairing create json", () => {
		const text = JSON.stringify({
			credential: "pair-code",
			pairUrl: "https://t3-abc.gpio-companion.com/pair#token=pair-code",
		});
		expect(extractT3PairingToken(text)).toBe("pair-code");
	});

	test("builds https device url", () => {
		expect(publicDeviceUrl("api-x.gpio-companion.com")).toBe(
			"https://api-x.gpio-companion.com",
		);
	});

	test("builds dashboard one-click t3 pair urls", () => {
		expect(t3PairPageUrl("t3-abc.gpio-companion.com", "abc123")).toBe(
			"https://t3-abc.gpio-companion.com/pair#token=abc123",
		);
		expect(dashboardT3PairPath("550e8400-e29b-41d4-a716-446655440000", "abc123")).toBe(
			"/devices/t3?uuid=550e8400-e29b-41d4-a716-446655440000#token=abc123",
		);
		expect(
			dashboardT3PairUrl("550e8400-e29b-41d4-a716-446655440000", "abc123"),
		).toBe(
			"https://gpio-companion.com/devices/t3?uuid=550e8400-e29b-41d4-a716-446655440000#token=abc123",
		);
		expect(
			parseDashboardT3PairLocation(
				"?uuid=550e8400-e29b-41d4-a716-446655440000",
				"#token=abc123",
			),
		).toEqual({
			uuid: "550e8400-e29b-41d4-a716-446655440000",
			token: "abc123",
		});
		expect(
			parseDashboardT3PairLocation(
				"?uuid=x&token=from-query",
				"",
			),
		).toEqual({ uuid: "x", token: "from-query" });
	});
});
