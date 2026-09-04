import { describe, expect, test } from "bun:test";
import {
	DEFAULT_AI_MODEL,
	DEFAULT_EMBEDDING_MODEL,
	generateDeviceKeyPair,
	openaiChatModelList,
} from "gpio-companion";
import { issueAiCredentials } from "../../../../lib/ai-credentials.ts";
import { registerAiKey } from "../../../../lib/credits.ts";
import type { StoredPairing } from "../../../../lib/pairing-store.ts";
import { onRequestGet } from "./models.ts";

class MemoryKv {
	store = new Map<string, string>();
	async get(key: string) {
		return this.store.get(key) ?? null;
	}
	async put(key: string, value: string) {
		this.store.set(key, value);
	}
}

function ctx(kv: MemoryKv, authorization?: string) {
	return {
		request: new Request("https://gpio-companion.com/api/ai/v1/models", {
			headers: authorization ? { authorization } : {},
		}),
		env: { DYNAMIC_PAGE_KV: kv as unknown as KVNamespace },
	};
}

describe("GET /api/ai/v1/models", () => {
	test("401 without api key", async () => {
		const response = await onRequestGet(ctx(new MemoryKv()));
		expect(response.status).toBe(401);
	});

	test("401 with unknown api key", async () => {
		const response = await onRequestGet(ctx(new MemoryKv(), "Bearer nope"));
		expect(response.status).toBe(401);
	});

	test("lists priced chat models", async () => {
		const kv = new MemoryKv();
		await registerAiKey(kv as unknown as KVNamespace, "user-1", "gpio-key");
		const response = await onRequestGet(ctx(kv, "Bearer gpio-key"));
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			object: string;
			data: Array<{ id: string }>;
		};
		expect(body.object).toBe("list");
		const ids = body.data.map((item) => item.id);
		expect(ids).toContain(DEFAULT_AI_MODEL);
		expect(ids).toContain("@cf/moonshotai/kimi-k2.7-code");
		expect(ids).not.toContain(DEFAULT_EMBEDDING_MODEL);
		expect(ids).toEqual(openaiChatModelList().map((item) => item.id));
	});

	test("accepts a device access token for a live pairing", async () => {
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
		const env = {
			DYNAMIC_PAGE_KV: kv as unknown as KVNamespace,
			GPIO_COMPANION_DEVICE_PRIVATE_KEY: keys.privateKeyPem,
		};
		const creds = await issueAiCredentials(env, "pair-uuid", "pair-key");
		const response = await onRequestGet({
			request: new Request("https://gpio-companion.com/api/ai/v1/models", {
				headers: { authorization: `Bearer ${creds.token}` },
			}),
			env,
		});
		expect(response.status).toBe(200);
	});
});
