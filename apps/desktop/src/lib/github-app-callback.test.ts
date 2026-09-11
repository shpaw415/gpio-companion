import { describe, expect, test } from "bun:test";
import { parseGithubAppCallbackFromUrl } from "./github-app-callback.ts";

describe("parseGithubAppCallbackFromUrl", () => {
	test("treats github iss as app oauth", () => {
		expect(
			parseGithubAppCallbackFromUrl(
				"https://gpio-companion.com/profile/github?code=abc&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth&state=st",
			),
		).toEqual({
			code: "abc",
			state: "st",
			installationId: "",
			redirectUri: "https://gpio-companion.com/profile/github",
		});
	});

	test("ignores desktop login callbacks", () => {
		expect(
			parseGithubAppCallbackFromUrl(
				"gpio-companion-desktop://auth/callback?code=x&state=st",
			),
		).toBeNull();
	});
});
