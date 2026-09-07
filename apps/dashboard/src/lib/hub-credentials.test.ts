import { describe, expect, test } from "bun:test";
import { generateDeviceKeyPair, verifyHubTicket } from "gpio-companion";
import { issueHubCredentials, verifyPiHubTicket } from "./hub-credentials.ts";
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

describe("hub credentials", () => {
	test("mints a pi ticket for a matching pairing key", async () => {
		const { env } = await seeded();
		const creds = await issueHubCredentials(env, "pair-uuid", "pair-key");
		expect(creds.token.startsWith("gpiohub.v1.")).toBe(true);
		expect(creds.wsUrl).toContain("uuid=pair-uuid");
		const claims = await verifyHubTicket({
			token: creds.token,
			privateKeyPem: env.GPIO_COMPANION_DEVICE_PRIVATE_KEY,
		});
		expect(claims.role).toBe("pi");
		await verifyPiHubTicket(env, creds.token, "pair-uuid");
	});

	test("rejects a bad pairing key", async () => {
		const { env } = await seeded();
		await expect(
			issueHubCredentials(env, "pair-uuid", "wrong"),
		).rejects.toThrow("pairing key mismatch");
	});

	test("mints a ticket for an unpaired board", async () => {
		const kv = new MemoryKv();
		const keys = await generateDeviceKeyPair();
		const env = {
			DYNAMIC_PAGE_KV: kv as unknown as KVNamespace,
			GPIO_COMPANION_DEVICE_PRIVATE_KEY: keys.privateKeyPem,
		};
		const creds = await issueHubCredentials(env, "fresh-uuid", "fresh-key");
		expect(creds.token.startsWith("gpiohub.v1.")).toBe(true);
	});
});
