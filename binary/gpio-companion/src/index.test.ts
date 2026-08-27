import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileSecretsStore } from "./secrets.ts";
import { startDeviceApi } from "./serve.ts";
import { fileConfigStore, tunnelEnvContents } from "./store.ts";

const dir = await mkdtemp(join(tmpdir(), "gpio-companion-"));
const configPath = join(dir, "config.json");
const secretsPath = join(dir, "secrets.env");
let applied = 0;

const server = startDeviceApi({
	port: 0,
	hostname: "127.0.0.1",
	store: fileConfigStore(configPath, "orangepi"),
	secrets: fileSecretsStore(secretsPath),
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
		expect(body.source).toBe("dashboard");
	});
});
