import { describe, expect, test } from "bun:test";
import {
	cachedAiCredentials,
	fetchAiCredentials,
	forgetAiCredentials,
	rememberAiCredentials,
} from "./ai-credentials.ts";

describe("ai credentials cache", () => {
	test("uses cache until skew", () => {
		rememberAiCredentials("u1", {
			token: "gpioai.v1.cached",
			expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
		});
		expect(cachedAiCredentials("u1")?.token).toBe("gpioai.v1.cached");
		forgetAiCredentials("u1");
		expect(cachedAiCredentials("u1")).toBeNull();
	});

	test("mints from the dashboard pairing endpoint", async () => {
		forgetAiCredentials("pair-uuid");
		const creds = await fetchAiCredentials({
			uuid: "pair-uuid",
			key: "pair-key",
			origin: "https://gpio-companion.com",
			fetchImpl: async () =>
				Response.json({
					token: "gpioai.v1.live",
					expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
				}),
		});
		expect(creds.token).toBe("gpioai.v1.live");
		expect(cachedAiCredentials("pair-uuid")?.token).toBe("gpioai.v1.live");
		forgetAiCredentials("pair-uuid");
	});

	test("rejects unknown pairing", async () => {
		forgetAiCredentials("missing");
		await expect(
			fetchAiCredentials({
				uuid: "missing",
				key: "pair-key",
				fetchImpl: async () =>
					Response.json({ error: "unknown pairing" }, { status: 403 }),
			}),
		).rejects.toThrow("unknown pairing");
	});
});
