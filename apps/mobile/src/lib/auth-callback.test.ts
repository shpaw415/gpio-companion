import { describe, expect, test } from "bun:test";
import {
	buildAuthCallbackUrl,
	firstParam,
	resolveAuthCallbackUrl,
	unwrapAuthCallbackUrl,
} from "./auth-callback.ts";

const redirect = "gpio-companion://auth/callback";
const inner = `${redirect}?code=abc&state=xyz`;

describe("unwrapAuthCallbackUrl", () => {
	test("keeps a direct callback url", () => {
		expect(unwrapAuthCallbackUrl(inner)).toBe(inner);
	});

	test("unwraps expo-dev-client wrapping", () => {
		const wrapped = `exp+gpio-companion://expo-development-client/?url=${encodeURIComponent(inner)}`;
		expect(unwrapAuthCallbackUrl(wrapped)).toBe(inner);
	});

	test("returns null when there is no code", () => {
		expect(unwrapAuthCallbackUrl(redirect)).toBeNull();
		expect(unwrapAuthCallbackUrl("gpio-companion:///")).toBeNull();
		expect(unwrapAuthCallbackUrl(null)).toBeNull();
	});
});

describe("resolveAuthCallbackUrl", () => {
	test("prefers explicit code over linking url", () => {
		expect(
			resolveAuthCallbackUrl({
				redirectUri: redirect,
				code: "from-params",
				state: "s1",
				linkingUrl: inner,
			}),
		).toBe(`${redirect}?code=from-params&state=s1`);
	});

	test("falls back to unwrapping the linking url", () => {
		const wrapped = `exp+gpio-companion://expo-development-client/?url=${encodeURIComponent(inner)}`;
		expect(
			resolveAuthCallbackUrl({
				redirectUri: redirect,
				linkingUrl: wrapped,
			}),
		).toBe(inner);
	});
});

describe("buildAuthCallbackUrl / firstParam", () => {
	test("builds a query string", () => {
		expect(buildAuthCallbackUrl(redirect, "c")).toBe(`${redirect}?code=c`);
	});

	test("picks the first string param", () => {
		expect(firstParam("a")).toBe("a");
		expect(firstParam(["b", "c"])).toBe("b");
		expect(firstParam(undefined)).toBeUndefined();
		expect(firstParam("")).toBeUndefined();
	});
});
