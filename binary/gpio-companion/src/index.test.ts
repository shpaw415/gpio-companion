import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDeviceKeyPair, signDeviceRequest } from "gpio-companion";
import { filePairingStore } from "./pairing.ts";
import { fileSecretsStore } from "./secrets.ts";
import { startDeviceApi } from "./serve.ts";
import { fileConfigStore, tunnelEnvContents } from "./store.ts";

const dir = await mkdtemp(join(tmpdir(), "gpio-companion-"));
const configPath = join(dir, "config.json");
const secretsPath = join(dir, "secrets.env");
const pairingPath = join(dir, "pairing.json");
const keys = await generateDeviceKeyPair();
let applied = 0;
let wifiSsid = "";

const server = startDeviceApi({
	port: 0,
	hostname: "127.0.0.1",
	store: fileConfigStore(configPath, "orangepi"),
	secrets: fileSecretsStore(secretsPath),
	pairing: filePairingStore(pairingPath, "pair-uuid", "pair-key"),
	applyTunnel: async () => {
		applied += 1;
	},
	applyWifi: async (config) => {
		wifiSsid = config.ssid;
		return { ssid: config.ssid };
	},
	deviceAuth: {
		keyId: keys.keyId,
		publicKeyPem: keys.publicKeyPem,
	},
});

afterAll(() => {
	server.stop();
});

async function deviceFetch(
	path: string,
	init: RequestInit = {},
	signed = true,
): Promise<Response> {
	const method = (init.method ?? "GET").toUpperCase();
	const body = typeof init.body === "string" ? init.body : "";
	const auth = signed
		? await signDeviceRequest({
				privateKeyPem: keys.privateKeyPem,
				keyId: keys.keyId,
				method,
				path: `/${path}`,
				body,
			})
		: {};
	return fetch(`${server.url}${path}`, {
		...init,
		headers: {
			"content-type": "application/json",
			...auth,
			...(init.headers ?? {}),
		},
	});
}

describe("gpio-companion-bin", () => {
	test("health", async () => {
		const response = await fetch(`${server.url}health`);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});

	test("rejects unsigned config writes", async () => {
		const response = await deviceFetch(
			"v1/config/secrets",
			{
				method: "PUT",
				body: JSON.stringify({ opencodeApiKey: "oc-key" }),
			},
			false,
		);
		expect(response.status).toBe(401);
	});

	test("sets tunnel replica endpoint", async () => {
		const response = await deviceFetch("v1/config/tunnel", {
			method: "PUT",
			body: JSON.stringify({
				token: "tunnel-token",
				hostname: "t3.gpio.example",
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			hardware: string;
			tunnel: { token: string; hostname: string };
		};
		expect(body.hardware).toBe("orangepi");
		expect(body.tunnel.token).toBe("***");
		expect(body.tunnel.hostname).toBe("t3.gpio.example");
		expect(applied).toBe(1);

		const status = await deviceFetch("v1/status");
		const statusBody = (await status.json()) as {
			tunnel: { configured: boolean; hostname: string };
			t3codePairing: string;
		};
		expect(statusBody.tunnel.configured).toBe(true);
		expect(statusBody.t3codePairing).toBe("dashboard");
	});

	test("quotes tunnel env values", () => {
		expect(tunnelEnvContents({ token: 'a"b', hostname: "host" })).toContain(
			'TUNNEL_TOKEN="a\\"b"',
		);
	});

	test("stores dashboard secrets without echoing them", async () => {
		const response = await deviceFetch("v1/config/secrets", {
			method: "PUT",
			body: JSON.stringify({
				opencodeApiKey: "oc-key",
				giteaToken: "gitea-key",
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			opencodeApiKey: boolean;
			giteaToken: boolean;
			source: string;
		};
		expect(body.opencodeApiKey).toBe(true);
		expect(body.giteaToken).toBe(true);
		expect(body.source).toBe("device-api");
	});

	test("sets gitea credentials on the pi api", async () => {
		const response = await deviceFetch("v1/config/gitea", {
			method: "PUT",
			body: JSON.stringify({
				giteaUrl: "https://git.example.com",
				giteaUsername: "ada",
				giteaToken: "gitea-key",
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as { giteaReady: boolean };
		expect(body.giteaReady).toBe(true);
	});

	test("rejects unsigned wifi and uuid mismatch", async () => {
		const unsigned = await deviceFetch(
			"v1/config/wifi",
			{
				method: "PUT",
				body: JSON.stringify({
					ssid: "bench",
					psk: "secret-pass",
					uuid: "pair-uuid",
				}),
			},
			false,
		);
		expect(unsigned.status).toBe(401);

		const mismatch = await deviceFetch("v1/config/wifi", {
			method: "PUT",
			body: JSON.stringify({
				ssid: "bench",
				psk: "secret-pass",
				uuid: "other-uuid",
			}),
		});
		expect(mismatch.status).toBe(403);
	});

	test("applies signed wifi when pairing uuid matches", async () => {
		const response = await deviceFetch("v1/config/wifi", {
			method: "PUT",
			body: JSON.stringify({
				ssid: "bench",
				psk: "secret-pass",
				uuid: "pair-uuid",
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			ssid: string;
			connected: boolean;
		};
		expect(body.ssid).toBe("bench");
		expect(body.connected).toBe(true);
		expect(wifiSsid).toBe("bench");
	});

	test("claims pairing uuid-key as gitea account", async () => {
		const denied = await deviceFetch("v1/pairing/claim", {
			method: "POST",
			body: JSON.stringify({
				uuid: "pair-uuid",
				key: "wrong",
				userId: "user-1",
				email: "ada@gpio-companion.com",
			}),
		});
		expect(denied.status).toBe(403);

		const claimed = await deviceFetch("v1/pairing/claim", {
			method: "POST",
			body: JSON.stringify({
				uuid: "pair-uuid",
				key: "pair-key",
				userId: "user-1",
				email: "ada@gpio-companion.com",
			}),
		});
		expect(claimed.status).toBe(200);
		const body = (await claimed.json()) as {
			paired: boolean;
			giteaLogin: string;
		};
		expect(body.paired).toBe(true);
		expect(body.giteaLogin).toBe("ada");
	});

	test("credentials are signed and include pairing key", async () => {
		const response = await deviceFetch("v1/pairing/credentials");
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			uuid: string;
			key: string;
			paired: boolean;
			userId: string;
		};
		expect(body.uuid).toBe("pair-uuid");
		expect(body.key).toBe("pair-key");
		expect(body.paired).toBe(true);
		expect(body.userId).toBe("user-1");
	});

	test("transfers owner and unpairs", async () => {
		const transferred = await deviceFetch("v1/pairing/transfer", {
			method: "POST",
			body: JSON.stringify({
				uuid: "pair-uuid",
				key: "pair-key",
				userId: "user-2",
				email: "bob@gpio-companion.com",
			}),
		});
		expect(transferred.status).toBe(200);
		const transferredBody = (await transferred.json()) as {
			giteaLogin: string;
			paired: boolean;
		};
		expect(transferredBody.paired).toBe(true);
		expect(transferredBody.giteaLogin).toBe("bob");

		const unpaired = await deviceFetch("v1/pairing/unpair", {
			method: "POST",
			body: JSON.stringify({
				uuid: "pair-uuid",
				key: "pair-key",
			}),
		});
		expect(unpaired.status).toBe(200);
		const unpairedBody = (await unpaired.json()) as { paired: boolean };
		expect(unpairedBody.paired).toBe(false);
	});
});
