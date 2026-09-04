import { describe, expect, test } from "bun:test";
import {
	isAiAccessToken,
	signAiAccessToken,
	verifyAiAccessToken,
} from "./ai-token.ts";
import { generateDeviceKeyPair } from "./device-auth.ts";

describe("ai access token", () => {
	test("signs and verifies a device token", async () => {
		const keys = await generateDeviceKeyPair();
		const minted = await signAiAccessToken({
			privateKeyPem: keys.privateKeyPem,
			uuid: "pair-uuid",
			now: 1_000,
			ttlMs: 60_000,
		});
		expect(isAiAccessToken(minted.token)).toBe(true);
		expect(minted.exp).toBe(61_000);
		const claims = await verifyAiAccessToken({
			token: minted.token,
			publicKeyPem: keys.publicKeyPem,
			now: 1_000,
		});
		expect(claims).toEqual({ uuid: "pair-uuid", exp: 61_000 });
	});

	test("rejects a forged or expired token", async () => {
		const keys = await generateDeviceKeyPair();
		const other = await generateDeviceKeyPair();
		const minted = await signAiAccessToken({
			privateKeyPem: keys.privateKeyPem,
			uuid: "pair-uuid",
			now: 1_000,
			ttlMs: 10,
		});
		await expect(
			verifyAiAccessToken({
				token: minted.token,
				publicKeyPem: other.publicKeyPem,
				now: 1_000,
			}),
		).rejects.toThrow("invalid ai token");
		await expect(
			verifyAiAccessToken({
				token: minted.token,
				publicKeyPem: keys.publicKeyPem,
				now: 1_011,
			}),
		).rejects.toThrow("expired ai token");
	});
});
