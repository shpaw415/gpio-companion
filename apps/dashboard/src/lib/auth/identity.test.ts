import { describe, expect, test } from "bun:test";
import {
	errorMessage,
	formatIdentityFailure,
	formatJwtInspect,
	inspectJwt,
} from "./identity.ts";

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

describe("inspectJwt", () => {
	test("reads header and payload without verifying", () => {
		const header = btoa(JSON.stringify({ alg: "ES256", kid: "k1" }))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replaceAll("=", "");
		const payload = btoa(
			JSON.stringify({
				iss: "https://auth.example.com",
				aud: "__gpio_companion_927ffcf9",
				exp: 4102444800,
				mode: "access",
			}),
		)
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replaceAll("=", "");
		const jwt = inspectJwt(`${header}.${payload}.sig`);
		expect(jwt.parts).toBe(3);
		expect(jwt.alg).toBe("ES256");
		expect(jwt.kid).toBe("k1");
		expect(jwt.iss).toBe("https://auth.example.com");
		expect(jwt.aud).toBe("__gpio_companion_927ffcf9");
		expect(jwt.mode).toBe("access");
		expect(jwt.expired).toBe(false);
		expect(formatJwtInspect(jwt)).toContain("alg=ES256");
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
