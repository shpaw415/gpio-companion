import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type DebugEvent,
	generateDeviceKeyPair,
	parseDebugEvent,
	signDeviceRequest,
	WifiConnectError,
} from "gpio-companion";
import { filePairingStore } from "./pairing.ts";
import { fileSecretsStore } from "./secrets.ts";
import { startDeviceApi } from "./serve.ts";
import { fileConfigStore } from "./store.ts";

const dir = await mkdtemp(join(tmpdir(), "gpio-companion-debug-"));
const keys = await generateDeviceKeyPair();
const server = startDeviceApi({
	port: 0,
	hostname: "127.0.0.1",
	store: fileConfigStore(join(dir, "config.json"), "orangepi"),
	secrets: fileSecretsStore(join(dir, "secrets.env")),
	pairing: filePairingStore(join(dir, "pairing.json"), "pair-uuid", "pair-key"),
	applyTunnel: async () => undefined,
	applyWifi: async (config) => {
		if (config.ssid === "missing") {
			throw new WifiConnectError("ssid-not-found");
		}
		return { ssid: config.ssid };
	},
	deviceAuth: {
		keyId: keys.keyId,
		publicKeyPem: keys.publicKeyPem,
	},
	clockTrusted: () => true,
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

async function waitFor(predicate: () => boolean, ms = 1000): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < ms) {
		if (predicate()) {
			return;
		}
		await Bun.sleep(10);
	}
	throw new Error("timeout");
}

describe("device debug suite", () => {
	test("rejects unsigned debug ticket", async () => {
		const response = await deviceFetch(
			"v1/debug/ticket",
			{ method: "POST" },
			false,
		);
		expect(response.status).toBe(401);
	});

	test("rejects missing and invalid debug tickets", async () => {
		const missing = await fetch(`${server.url}v1/debug`);
		expect(missing.status).toBe(401);
		const invalid = await fetch(`${server.url}v1/debug?ticket=nope`);
		expect(invalid.status).toBe(401);
	});

	test("rejects debug origin that is not the dashboard", async () => {
		const minted = await deviceFetch("v1/debug/ticket", { method: "POST" });
		expect(minted.status).toBe(200);
		const body = (await minted.json()) as { ticket: string };
		const blocked = await fetch(`${server.url}v1/debug?ticket=${body.ticket}`, {
			headers: { origin: "https://evil.example" },
		});
		expect(blocked.status).toBe(401);
	});

	test("streams request warnings without secrets", async () => {
		const minted = await deviceFetch("v1/debug/ticket", { method: "POST" });
		expect(minted.status).toBe(200);
		const body = (await minted.json()) as {
			ticket: string;
			expiresAt: number;
		};
		expect(body.ticket).toMatch(/^[a-f0-9]{64}$/);
		expect(body.expiresAt).toBeGreaterThan(Date.now());

		const events: DebugEvent[] = [];
		const ws = new WebSocket(
			`${String(server.url).replace(/^http/, "ws")}v1/debug?ticket=${body.ticket}`,
		);
		ws.addEventListener("message", (event) => {
			const parsed = parseDebugEvent(JSON.parse(String(event.data)));
			if (parsed) {
				events.push(parsed);
			}
		});
		await new Promise<void>((resolve, reject) => {
			ws.addEventListener("open", () => resolve());
			ws.addEventListener("error", () => reject(new Error("ws error")));
		});

		const status = await deviceFetch("v1/status");
		expect(status.status).toBe(200);
		await Bun.sleep(50);
		expect(events).toEqual([]);

		const wifi = await deviceFetch("v1/config/wifi", {
			method: "PUT",
			body: JSON.stringify({
				ssid: "missing",
				psk: "secret-psk-value",
				uuid: "pair-uuid",
			}),
		});
		expect(wifi.status).toBe(400);
		await waitFor(() => events.length > 0);
		expect(events[0]).toMatchObject({
			level: "warning",
			method: "PUT",
			path: "/v1/config/wifi",
			status: 400,
			message: "wifi network not found",
		});
		expect(JSON.stringify(events)).not.toContain("secret-psk-value");
		expect(JSON.stringify(events)).not.toContain("pair-key");
		ws.close();
	});

	test("streams not-found warnings", async () => {
		const minted = await deviceFetch("v1/debug/ticket", { method: "POST" });
		const body = (await minted.json()) as { ticket: string };
		const events: DebugEvent[] = [];
		const ws = new WebSocket(
			`${String(server.url).replace(/^http/, "ws")}v1/debug?ticket=${body.ticket}`,
		);
		ws.addEventListener("message", (event) => {
			const parsed = parseDebugEvent(JSON.parse(String(event.data)));
			if (parsed) {
				events.push(parsed);
			}
		});
		await new Promise<void>((resolve, reject) => {
			ws.addEventListener("open", () => resolve());
			ws.addEventListener("error", () => reject(new Error("ws error")));
		});
		const missing = await deviceFetch("v1/nope");
		expect(missing.status).toBe(404);
		await waitFor(() =>
			events.some((event) => event.status === 404 && event.path === "/v1/nope"),
		);
		ws.close();
	});
});
