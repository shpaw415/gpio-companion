import { describe, expect, test } from "bun:test";
import { generateDeviceKeyPair, verifyVoiceTicket } from "gpio-companion";
import type { StoredPairing } from "./pairing-store.ts";
import {
	issueVoiceTicket,
	verifyVoiceAccessTicket,
} from "./voice-credentials.ts";

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
	bleMac: "",
};

describe("voice tickets", () => {
	test("mints an owner ticket", async () => {
		const kv = new MemoryKv();
		const keys = await generateDeviceKeyPair();
		await kv.put("pair:pair-uuid", "user-1");
		await kv.put("device:user-1", JSON.stringify([pairing]));
		const env = {
			DYNAMIC_PAGE_KV: kv as unknown as KVNamespace,
			GPIO_COMPANION_DEVICE_PRIVATE_KEY: keys.privateKeyPem,
		};
		const ticket = await issueVoiceTicket(
			env,
			"user-1",
			"pair-uuid",
			"https://gpio-companion.com",
		);
		const claims = await verifyVoiceTicket({
			token: ticket.token,
			privateKeyPem: keys.privateKeyPem,
		});
		expect(claims.userId).toBe("user-1");
		expect(claims.uuid).toBe("pair-uuid");
		const access = await verifyVoiceAccessTicket(
			env,
			ticket.token,
			"pair-uuid",
		);
		expect(access.userId).toBe("user-1");
	});

	test("rejects another account", async () => {
		const kv = new MemoryKv();
		const keys = await generateDeviceKeyPair();
		await kv.put("pair:pair-uuid", "user-1");
		await kv.put("device:user-1", JSON.stringify([pairing]));
		const env = {
			DYNAMIC_PAGE_KV: kv as unknown as KVNamespace,
			GPIO_COMPANION_DEVICE_PRIVATE_KEY: keys.privateKeyPem,
		};
		await expect(issueVoiceTicket(env, "user-2", "pair-uuid")).rejects.toThrow(
			"pair a device first",
		);
	});
});
