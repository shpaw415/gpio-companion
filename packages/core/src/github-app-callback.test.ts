import { describe, expect, test } from "bun:test";
import {
	parseGithubAppCallbackFromUrl,
	parseGithubAppCallbackSearch,
} from "./github-app-callback.ts";

describe("parseGithubAppCallbackSearch", () => {
	test("accepts oauth code+state without installation_id", () => {
		expect(
			parseGithubAppCallbackSearch(
				"/profile/github",
				"?code=abc&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth&state=st",
				"https://gpio-companion.com",
			),
		).toEqual({
			code: "abc",
			state: "st",
			installationId: "",
			redirectUri: "https://gpio-companion.com/profile/github",
		});
	});

	test("ignores openauthster callback path", () => {
		expect(
			parseGithubAppCallbackSearch(
				"/callback",
				"?code=abc&state=st",
				"https://gpio-companion.com",
			),
		).toBeNull();
	});
});

describe("parseGithubAppCallbackFromUrl", () => {
	test("detects github oauth iss on a native deep link", () => {
		expect(
			parseGithubAppCallbackFromUrl(
				"gpio-companion://auth/callback?code=abc&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth&state=st",
			),
		).toEqual({
			code: "abc",
			state: "st",
			installationId: "",
			redirectUri: "gpio-companion://auth/callback",
		});
	});

	test("ignores openauthster login callbacks without github iss", () => {
		expect(
			parseGithubAppCallbackFromUrl(
				"gpio-companion://auth/callback?code=abc&state=st",
			),
		).toBeNull();
	});
});
