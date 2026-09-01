import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	generateDeviceKeyPair,
	signDeviceRequest,
	WifiConnectError,
} from "gpio-companion";
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
let t3PairedCalls = 0;
let t3Revoked = 0;
let t3Paired = false;
let t3Running = false;
let t3PairingUrl = "";
const clockSets: number[] = [];

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
		if (config.ssid === "missing") {
			throw new WifiConnectError("ssid-not-found");
		}
		if (config.ssid === "badpass") {
			throw new WifiConnectError("password");
		}
		if (config.ssid === "nowifi") {
			throw new WifiConnectError("no-device");
		}
		wifiSsid = config.ssid;
		return { ssid: config.ssid };
	},
	t3: {
		async pair(hostname) {
			t3PairedCalls += 1;
			t3Running = true;
			t3PairingUrl = `https://${hostname}/pair#token=test`;
			return { pairingUrl: t3PairingUrl, pairingToken: "test" };
		},
		async status() {
			return {
				running: t3Running,
				pairingUrl: t3PairingUrl,
				pairingToken: t3PairingUrl ? "test" : "",
				paired: t3Paired,
				serviceInstalled: true,
			};
		},
		async revoke() {
			t3Revoked += 1;
			t3Paired = false;
			t3PairingUrl = "";
		},
	},
	revokeT3: async () => {
		t3Revoked += 1;
	},
	deviceAuth: {
		keyId: keys.keyId,
		publicKeyPem: keys.publicKeyPem,
	},
	applyClock: async (issuedMs) => {
		clockSets.push(issuedMs);
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
				body: JSON.stringify({ gpioAiKey: "ai-key" }),
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
		expect(
			tunnelEnvContents({
				token: 'a"b',
				hostname: "host",
				apiHostname: "",
				tunnelId: "",
			}),
		).toContain('TUNNEL_TOKEN="a\\"b"');
	});

	test("stores dashboard secrets without echoing them", async () => {
		const response = await deviceFetch("v1/config/secrets", {
			method: "PUT",
			body: JSON.stringify({
				gpioAiKey: "ai-key",
				githubToken: "gh-key",
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			gpioAiKey: boolean;
			githubToken: boolean;
			source: string;
		};
		expect(body.gpioAiKey).toBe(true);
		expect(body.githubToken).toBe(true);
		expect(body.source).toBe("device-api");
	});

	test("returns the baked gpio ai key when signed", async () => {
		const response = await deviceFetch("v1/config/ai-key");
		expect(response.status).toBe(200);
		const body = (await response.json()) as { gpioAiKey: string };
		expect(body.gpioAiKey).toBe("ai-key");
	});

	test("sets github credentials on the pi api", async () => {
		const response = await deviceFetch("v1/config/github", {
			method: "PUT",
			body: JSON.stringify({
				githubUsername: "ada",
				githubToken: "gh-key",
			}),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			githubReady: boolean;
			githubUrl: boolean;
		};
		expect(body.githubReady).toBe(true);
		expect(body.githubUrl).toBe(true);
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

	test("sets the clock from a valid future wifi signature", async () => {
		const issued = Date.now() + 180_000;
		const body = JSON.stringify({
			ssid: "bench",
			psk: "secret-pass",
			uuid: "pair-uuid",
		});
		const auth = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/config/wifi",
			body,
			now: issued,
		});
		const response = await fetch(`${server.url}v1/config/wifi`, {
			method: "PUT",
			headers: {
				"content-type": "application/json",
				...auth,
			},
			body,
		});
		expect(response.status).toBe(200);
		expect(clockSets.at(-1)).toBe(issued);

		const older = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/config/wifi",
			body,
			now: Date.now() + 90_000,
		});
		const replay = await fetch(`${server.url}v1/config/wifi`, {
			method: "PUT",
			headers: {
				"content-type": "application/json",
				...older,
			},
			body,
		});
		expect(replay.status).toBe(403);
		expect(await replay.json()).toEqual({
			error: "expired device signature",
		});
		expect(clockSets.at(-1)).toBe(issued);
	});

	test("rejects an expired wifi signature without setting the clock", async () => {
		const before = clockSets.length;
		const body = JSON.stringify({
			ssid: "bench",
			psk: "secret-pass",
			uuid: "pair-uuid",
		});
		const auth = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/config/wifi",
			body,
			now: Date.now() - 120_000,
		});
		const response = await fetch(`${server.url}v1/config/wifi`, {
			method: "PUT",
			headers: {
				"content-type": "application/json",
				...auth,
			},
			body,
		});
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: "expired device signature",
		});
		expect(clockSets.length).toBe(before);
	});

	test("does not set the clock for an invalid future signature", async () => {
		const before = clockSets.length;
		const body = JSON.stringify({
			ssid: "bench",
			psk: "secret-pass",
			uuid: "pair-uuid",
		});
		const auth = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/config/wifi",
			body,
			now: Date.now() + 240_000,
		});
		auth["X-Gpio-Signature"] = btoa("not-a-real-signature");
		const response = await fetch(`${server.url}v1/config/wifi`, {
			method: "PUT",
			headers: {
				"content-type": "application/json",
				...auth,
			},
			body,
		});
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: "invalid device signature",
		});
		expect(clockSets.length).toBe(before);
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

	test("returns classified wifi connect failures", async () => {
		const missing = await deviceFetch("v1/config/wifi", {
			method: "PUT",
			body: JSON.stringify({
				ssid: "missing",
				psk: "secret-pass",
				uuid: "pair-uuid",
			}),
		});
		expect(missing.status).toBe(400);
		expect(await missing.json()).toEqual({
			ssid: "missing",
			connected: false,
			reason: "ssid-not-found",
			error: "wifi network not found",
		});

		const badpass = await deviceFetch("v1/config/wifi", {
			method: "PUT",
			body: JSON.stringify({
				ssid: "badpass",
				psk: "secret-pass",
				uuid: "pair-uuid",
			}),
		});
		expect(badpass.status).toBe(400);
		expect(await badpass.json()).toEqual({
			ssid: "badpass",
			connected: false,
			reason: "password",
			error: "wifi password incorrect",
		});

		const nowifi = await deviceFetch("v1/config/wifi", {
			method: "PUT",
			body: JSON.stringify({
				ssid: "nowifi",
				psk: "secret-pass",
				uuid: "pair-uuid",
			}),
		});
		expect(nowifi.status).toBe(400);
		expect(await nowifi.json()).toEqual({
			ssid: "nowifi",
			connected: false,
			reason: "no-device",
			error: "wifi adapter not available",
		});
	});

	test("claims pairing uuid-key", async () => {
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
			login: string;
		};
		expect(body.paired).toBe(true);
		expect(body.login).toBe("ada");
	});

	test("credentials are signed and include pairing key", async () => {
		await deviceFetch("v1/config/tunnel", {
			method: "PUT",
			body: JSON.stringify({
				token: "tunnel-token",
				hostname: "t3.gpio.example",
				apiHostname: "api.gpio.example",
				tunnelId: "tun-1",
			}),
		});
		const response = await deviceFetch("v1/pairing/credentials");
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			uuid: string;
			key: string;
			paired: boolean;
			userId: string;
			deviceUrl: string;
		};
		expect(body.uuid).toBe("pair-uuid");
		expect(body.key).toBe("pair-key");
		expect(body.paired).toBe(true);
		expect(body.userId).toBe("user-1");
		expect(body.deviceUrl).toBe("https://api.gpio.example");
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
			login: string;
			paired: boolean;
		};
		expect(transferredBody.paired).toBe(true);
		expect(transferredBody.login).toBe("bob");

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
		expect(t3Revoked).toBeGreaterThan(0);
	});

	test("rejects unsigned t3 pair", async () => {
		const response = await deviceFetch(
			"v1/t3/pair",
			{ method: "POST", body: "" },
			false,
		);
		expect(response.status).toBe(401);
	});

	test("pairs t3 against the running service", async () => {
		await deviceFetch("v1/config/tunnel", {
			method: "PUT",
			body: JSON.stringify({
				token: "tunnel-token",
				hostname: "t3.gpio.example",
				apiHostname: "api.gpio.example",
				tunnelId: "tun-1",
			}),
		});
		const paired = await deviceFetch("v1/t3/pair", {
			method: "POST",
			body: "",
		});
		expect(paired.status).toBe(200);
		const pairedBody = (await paired.json()) as {
			pairingUrl: string;
			pairingToken: string;
		};
		expect(pairedBody.pairingUrl).toBe(
			"https://t3.gpio.example/pair#token=test",
		);
		expect(pairedBody.pairingToken).toBe("test");
		expect(t3PairedCalls).toBe(1);
	});

	test("github token is loopback only", async () => {
		const response = await fetch(`${server.url}v1/github-token`);
		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("not configured");
	});
});
