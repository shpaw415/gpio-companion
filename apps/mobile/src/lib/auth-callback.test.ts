import { describe, expect, test } from "bun:test";
import {
	buildAuthCallbackUrl,
	firstParam,
	parseGithubAppCallbackFromUrl,
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

describe("parseGithubAppCallbackFromUrl", () => {
	test("treats github iss as app oauth, not login", () => {
		expect(
			parseGithubAppCallbackFromUrl(
				`${redirect}?code=abc&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth&state=st`,
			),
		).toEqual({
			code: "abc",
			state: "st",
			installationId: "",
			redirectUri: redirect,
		});
	});

	test("ignores openauthster login callbacks", () => {
		expect(parseGithubAppCallbackFromUrl(inner)).toBeNull();
	});

	test("accepts web profile github oauth", () => {
		expect(
			parseGithubAppCallbackFromUrl(
				"https://gpio-companion.com/profile/github?code=abc&state=st",
			)?.code,
		).toBe("abc");
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
