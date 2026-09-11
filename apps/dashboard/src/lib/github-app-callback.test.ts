import { describe, expect, test } from "bun:test";
import { parseGithubAppCallbackSearch } from "./github-app-callback.ts";

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

	test("accepts installation_id without code", () => {
		expect(
			parseGithubAppCallbackSearch(
				"/devices/keys",
				"?installation_id=9&state=st",
				"https://gpio-companion.com",
			),
		).toEqual({
			code: "",
			state: "st",
			installationId: "9",
			redirectUri: "https://gpio-companion.com/devices/keys",
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
