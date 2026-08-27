import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filePairingStore } from "./pairing.ts";
import { fileSecretsStore } from "./secrets.ts";
import { startDeviceApi } from "./serve.ts";
import { fileConfigStore, tunnelEnvContents } from "./store.ts";

const dir = await mkdtemp(join(tmpdir(), "gpio-companion-"));
const configPath = join(dir, "config.json");
const secretsPath = join(dir, "secrets.env");
const pairingPath = join(dir, "pairing.json");
let applied = 0;

const server = startDeviceApi({
	port: 0,
	hostname: "127.0.0.1",
	store: fileConfigStore(configPath, "orangepi"),
	secrets: fileSecretsStore(secretsPath),
	pairing: filePairingStore(pairingPath, "pair-uuid", "pair-key"),
	applyTunnel: async () => {
		applied += 1;
	},
});

afterAll(() => {
	server.stop();
});

describe("gpio-companion-bin", () => {
	test("health", async () => {
		const response = await fetch(`${server.url}health`);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});

	test("sets tunnel replica endpoint", async () => {
		const response = await fetch(`${server.url}v1/config/tunnel`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
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

		const status = await fetch(`${server.url}v1/status`);
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
		const response = await fetch(`${server.url}v1/config/secrets`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
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
		const response = await fetch(`${server.url}v1/config/gitea`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
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

	test("claims pairing uuid-key as gitea account", async () => {
		const denied = await fetch(`${server.url}v1/pairing/claim`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				uuid: "pair-uuid",
				key: "wrong",
				userId: "user-1",
				email: "ada@gpio-companion.com",
			}),
		});
		expect(denied.status).toBe(403);

		const claimed = await fetch(`${server.url}v1/pairing/claim`, {
			method: "POST",
			headers: { "content-type": "application/json" },
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
});
