import {
	type DeviceConfig,
	mergeDeviceSecrets,
	parseDeviceSecrets,
	parsePairingClaim,
	parseTunnelConfig,
	publicPairing,
	redactDeviceConfig,
	secretsStatus,
	VERSION,
} from "gpio-companion";
import { applyClaim, type PairingStore } from "./pairing.ts";
import type { SecretsStore } from "./secrets.ts";
import { type ConfigStore, DEFAULT_PORT } from "./store.ts";
import type { ApplyTunnel } from "./tunnel.ts";

export type ServeOptions = {
	port?: number;
	hostname?: string;
	store: ConfigStore;
	secrets: SecretsStore;
	pairing: PairingStore;
	applyTunnel: ApplyTunnel;
};

export function startDeviceApi(options: ServeOptions) {
	const port = options.port ?? DEFAULT_PORT;
	const hostname = options.hostname ?? "0.0.0.0";
	return Bun.serve({
		port,
		hostname,
		async fetch(request) {
			if (request.method === "OPTIONS") {
				return cors(new Response(null, { status: 204 }));
			}
			try {
				return cors(
					await handleDeviceRequest(
						request,
						options.store,
						options.secrets,
						options.pairing,
						options.applyTunnel,
					),
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "request failed";
				const status =
					message.includes("mismatch") || message.includes("already paired")
						? 403
						: 400;
				return cors(Response.json({ error: message }, { status }));
			}
		},
	});
}

export async function handleDeviceRequest(
	request: Request,
	store: ConfigStore,
	secretsStore: SecretsStore,
	pairingStore: PairingStore,
	applyTunnel: ApplyTunnel,
): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname.replace(/\/+$/, "") || "/";

	if (request.method === "GET" && path === "/health") {
		return json({ ok: true, version: VERSION });
	}

	if (request.method === "GET" && path === "/v1/pairing") {
		const config = await store.read();
		const pairing = await pairingStore.read();
		return json({
			...publicPairing(pairing),
			hardware: config.hardware,
			hostname: config.tunnel.hostname,
		});
	}

	if (request.method === "POST" && path === "/v1/pairing/claim") {
		const claim = parsePairingClaim(await readJson(request));
		const current = await pairingStore.read();
		const next = applyClaim(current, claim);
		await pairingStore.write(next);
		return json(publicPairing(next));
	}

	if (request.method === "GET" && path === "/v1/config") {
		return json(redactDeviceConfig(await store.read()));
	}

	if (request.method === "PUT" && path === "/v1/config") {
		const body = await readObject(request);
		const current = await store.read();
		const next: DeviceConfig = {
			hardware: current.hardware,
			tunnel:
				body.tunnel !== undefined
					? parseTunnelConfig(body.tunnel)
					: current.tunnel,
		};
		return persist(store, applyTunnel, next);
	}

	if (request.method === "PUT" && path === "/v1/config/tunnel") {
		const current = await store.read();
		const next: DeviceConfig = {
			...current,
			tunnel: parseTunnelConfig(await readJson(request)),
		};
		return persist(store, applyTunnel, next);
	}

	if (request.method === "GET" && path === "/v1/config/secrets") {
		return json(secretsStatus(await secretsStore.read()));
	}

	if (request.method === "PUT" && path === "/v1/config/secrets") {
		const current = await secretsStore.read();
		const next = mergeDeviceSecrets(
			current,
			parseDeviceSecrets(await readJson(request)),
		);
		await secretsStore.write(next);
		return json(secretsStatus(next));
	}

	if (request.method === "PUT" && path === "/v1/config/gitea") {
		const current = await secretsStore.read();
		const next = mergeDeviceSecrets(
			current,
			parseDeviceSecrets(await readJson(request)),
		);
		if (!next.giteaUrl || !next.giteaUsername || !next.giteaToken) {
			throw new Error("giteaUrl, giteaUsername, and giteaToken are required");
		}
		await secretsStore.write(next);
		return json(secretsStatus(next));
	}

	if (request.method === "GET" && path === "/v1/status") {
		const config = await store.read();
		const secrets = await secretsStore.read();
		const pairing = await pairingStore.read();
		return json({
			hardware: config.hardware,
			tunnel: {
				configured: Boolean(config.tunnel.token),
				hostname: config.tunnel.hostname,
			},
			secrets: secretsStatus(secrets),
			pairing: publicPairing(pairing),
			t3codePairing: "dashboard",
		});
	}

	return json({ error: "not found" }, 404);
}

async function persist(
	store: ConfigStore,
	applyTunnel: ApplyTunnel,
	config: DeviceConfig,
): Promise<Response> {
	await store.write(config);
	await applyTunnel(config);
	return json(redactDeviceConfig(config));
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new Error("invalid json");
	}
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
	const body = await readJson(request);
	if (body === null || typeof body !== "object" || Array.isArray(body)) {
		throw new Error("body must be an object");
	}
	return body as Record<string, unknown>;
}

function json(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

function cors(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "content-type");
	return new Response(response.body, {
		status: response.status,
		headers,
	});
}
