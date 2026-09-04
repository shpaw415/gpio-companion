import { describe, expect, test } from "bun:test";
import { generateDeviceKeyPair } from "gpio-companion";
import { issueAiCredentials, userIdForAiAuth } from "./ai-credentials.ts";
import { registerAiKey } from "./credits.ts";
import type { StoredPairing } from "./pairing-store.ts";

class MemoryKv {
	store = new Map<string, string>();
	async get(key: string) {
		return this.store.get(key) ?? null;
	}
	async put(key: string, value: string) {
		this.store.set(key, value);
	}
	async delete(key: string) {
		this.store.delete(key);
	}
}

const pairing: StoredPairing = {
	userId: "user-1",
	uuid: "pair-uuid",
	key: "pair-key",
	deviceUrl: "https://api.example",
	login: "ada",
	email: "ada@example.com",
	claimedAt: "2026-08-31T00:00:00.000Z",
	label: "",
};

async function seeded(owner = "user-1") {
	const kv = new MemoryKv();
	const keys = await generateDeviceKeyPair();
	await kv.put("pair:pair-uuid", owner);
	await kv.put(
		`device:${owner}`,
		JSON.stringify([{ ...pairing, userId: owner }]),
	);
	return {
		kv,
		env: {
			DYNAMIC_PAGE_KV: kv as unknown as KVNamespace,
			GPIO_COMPANION_DEVICE_PRIVATE_KEY: keys.privateKeyPem,
		},
	};
}

describe("ai credentials", () => {
	test("mints a token for a matching pairing key", async () => {
		const { env } = await seeded();
		const creds = await issueAiCredentials(env, "pair-uuid", "pair-key");
		expect(creds.token.startsWith("gpioai.v1.")).toBe(true);
		expect(await userIdForAiAuth(env, creds.token)).toBe("user-1");
	});

	test("rejects a bad pairing key", async () => {
		const { env } = await seeded();
		await expect(issueAiCredentials(env, "pair-uuid", "wrong")).rejects.toThrow(
			"pairing key mismatch",
		);
	});

	test("unknown pairing cannot mint", async () => {
		const { env } = await seeded();
		await expect(
			issueAiCredentials(env, "missing", "pair-key"),
		).rejects.toThrow("unknown pairing");
	});

	test("unpair revokes a live token", async () => {
		const { kv, env } = await seeded();
		const creds = await issueAiCredentials(env, "pair-uuid", "pair-key");
		await kv.delete("pair:pair-uuid");
		expect(await userIdForAiAuth(env, creds.token)).toBeNull();
	});

	test("transfer bills the new owner without rotating the token", async () => {
		const { kv, env } = await seeded();
		const creds = await issueAiCredentials(env, "pair-uuid", "pair-key");
		await kv.put("pair:pair-uuid", "user-2");
		expect(await userIdForAiAuth(env, creds.token)).toBe("user-2");
	});

	test("legacy hashed GPIO_AI_KEY still maps to a user", async () => {
		const { env } = await seeded();
		await registerAiKey(env.DYNAMIC_PAGE_KV, "user-1", "gpio-key");
		expect(await userIdForAiAuth(env, "gpio-key")).toBe("user-1");
	});
});
