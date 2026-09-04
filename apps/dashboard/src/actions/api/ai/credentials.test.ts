import { describe, expect, test } from "bun:test";
import { generateDeviceKeyPair } from "gpio-companion";
import type { StoredPairing } from "../../../lib/pairing-store.ts";
import { onRequestPost } from "./credentials.ts";

class MemoryKv {
	store = new Map<string, string>();
	async get(key: string) {
		return this.store.get(key) ?? null;
	}
	async put(key: string, value: string) {
		this.store.set(key, value);
	}
}

describe("POST /api/ai/credentials", () => {
	test("mints a device token", async () => {
		const kv = new MemoryKv();
		const keys = await generateDeviceKeyPair();
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
		await kv.put("pair:pair-uuid", "user-1");
		await kv.put("device:user-1", JSON.stringify([pairing]));
		const response = await onRequestPost({
			env: {
				DYNAMIC_PAGE_KV: kv as unknown as KVNamespace,
				GPIO_COMPANION_DEVICE_PRIVATE_KEY: keys.privateKeyPem,
			},
			request: new Request("https://gpio-companion.com/api/ai/credentials", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ uuid: "pair-uuid", key: "pair-key" }),
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as { token: string };
		expect(body.token.startsWith("gpioai.v1.")).toBe(true);
	});

	test("403 on pairing key mismatch", async () => {
		const kv = new MemoryKv();
		const keys = await generateDeviceKeyPair();
		await kv.put("pair:pair-uuid", "user-1");
		await kv.put(
			"device:user-1",
			JSON.stringify([
				{
					userId: "user-1",
					uuid: "pair-uuid",
					key: "pair-key",
					deviceUrl: "",
					login: "ada",
					email: "",
					claimedAt: "",
					label: "",
				},
			]),
		);
		const response = await onRequestPost({
			env: {
				DYNAMIC_PAGE_KV: kv as unknown as KVNamespace,
				GPIO_COMPANION_DEVICE_PRIVATE_KEY: keys.privateKeyPem,
			},
			request: new Request("https://gpio-companion.com/api/ai/credentials", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ uuid: "pair-uuid", key: "wrong" }),
			}),
		});
		expect(response.status).toBe(403);
	});
});
