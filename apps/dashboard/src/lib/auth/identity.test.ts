import { describe, expect, test } from "bun:test";
import { errorMessage, formatIdentityFailure } from "./identity.ts";

describe("formatIdentityFailure", () => {
	test("missing token stays sign in first", () => {
		expect(
			formatIdentityFailure({
				hasToken: false,
				tokenBytes: 0,
				sessionError: "br-connection-profile-unavailable",
				metaError: null,
				id: null,
			}),
		).toBe("sign in first");
	});

	test("keeps issuer session errors", () => {
		expect(
			formatIdentityFailure({
				hasToken: true,
				tokenBytes: 120,
				sessionError:
					"Failed to fetch user session: br-connection-profile-unavailable",
				metaError: null,
				id: null,
			}),
		).toBe(
			"profile unavailable; tokenBytes=120; session=Failed to fetch user session: br-connection-profile-unavailable",
		);
	});

	test("notes empty session and meta", () => {
		expect(
			formatIdentityFailure({
				hasToken: true,
				tokenBytes: 40,
				sessionError: null,
				metaError: null,
				id: null,
			}),
		).toBe(
			"profile unavailable; tokenBytes=40; session and meta returned no user id",
		);
	});
});

describe("errorMessage", () => {
	test("joins cause chain", () => {
		expect(
			errorMessage(
				new Error("Failed to verify token from request.", {
					cause: new Error("br-connection-profile-unavailable"),
				}),
			),
		).toBe(
			"Failed to verify token from request.: br-connection-profile-unavailable",
		);
	});
});
