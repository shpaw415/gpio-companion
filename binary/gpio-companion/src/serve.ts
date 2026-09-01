import {
	DeviceAuthError,
	type DeviceConfig,
	mergeDeviceSecrets,
	pairingCredentials,
	parseDeviceSecrets,
	parsePairingClaim,
	parsePairingUnpair,
	parseTunnelConfig,
	parseWifiConfig,
	publicDeviceUrl,
	publicPairing,
	publicWifiFailure,
	publicWifiStatus,
	redactDeviceConfig,
	secretsStatus,
	VERSION,
	verifyDeviceRequest,
	WifiConnectError,
} from "gpio-companion";
import type { GithubInstallationCreds } from "./github-credentials.ts";
import {
	applyClaim,
	applyTransfer,
	applyUnpair,
	type PairingStore,
} from "./pairing.ts";
import type { SecretsStore } from "./secrets.ts";
import { type ConfigStore, DEFAULT_PORT } from "./store.ts";
import type { T3Controller } from "./t3.ts";
import type { ApplyTunnel } from "./tunnel.ts";
import type { ApplyWifi } from "./wifi.ts";

export type DeviceAuthConfig = {
	keyId: string;
	publicKeyPem: string;
};

export type ServeOptions = {
	port?: number;
	hostname?: string;
	store: ConfigStore;
	secrets: SecretsStore;
	pairing: PairingStore;
	applyTunnel: ApplyTunnel;
	applyWifi?: ApplyWifi;
	revokeT3?: () => Promise<void>;
	t3?: T3Controller;
	deviceAuth: DeviceAuthConfig;
	githubCredentials?: () => Promise<GithubInstallationCreds>;
};

export function startDeviceApi(options: ServeOptions) {
	const port = options.port ?? DEFAULT_PORT;
	const hostname = options.hostname ?? "0.0.0.0";
	return Bun.serve({
		port,
		hostname,
		async fetch(request) {
			if (request.method === "OPTIONS") {
				return new Response(null, { status: 204 });
			}
			try {
				return await handleDeviceRequest(
					request,
					options.store,
					options.secrets,
					options.pairing,
					options.applyTunnel,
					options.applyWifi,
					options.revokeT3,
					options.t3,
					options.deviceAuth,
					options.githubCredentials,
				);
			} catch (error) {
				if (error instanceof DeviceAuthError) {
					return Response.json(
						{ error: error.message },
						{ status: error.status },
					);
				}
				const message =
					error instanceof Error ? error.message : "request failed";
				const status =
					message.includes("mismatch") ||
					message.includes("already paired") ||
					message.includes("local-only")
						? 403
						: 400;
				return Response.json({ error: message }, { status });
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
	applyWifi: ApplyWifi | undefined,
	revokeT3: (() => Promise<void>) | undefined,
	t3: T3Controller | undefined,
	deviceAuth: DeviceAuthConfig,
	githubCredentials?: () => Promise<GithubInstallationCreds>,
): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname.replace(/\/+$/, "") || "/";
	const method = request.method.toUpperCase();
	const bodyText =
		method === "GET" || method === "HEAD" ? "" : await request.text();

	if (method === "GET" && path === "/health") {
		return json({ ok: true, version: VERSION });
	}

	if (method === "GET" && path === "/v1/github-token") {
		if (!isLoopback(url)) {
			throw new Error("github token is local-only");
		}
		if (!githubCredentials) {
			throw new Error("github credentials are not configured");
		}
		return json(await githubCredentials());
	}

	if (!deviceAuth.publicKeyPem.trim()) {
		throw new DeviceAuthError("device public key not registered", 401);
	}

	await verifyDeviceRequest({
		publicKeyPem: deviceAuth.publicKeyPem,
		keyId: deviceAuth.keyId,
		method,
		path,
		body: bodyText,
		headers: request.headers,
	});

	if (method === "GET" && path === "/v1/pairing") {
		const config = await store.read();
		const pairing = await pairingStore.read();
		return json({
			...publicPairing(pairing),
			hardware: config.hardware,
			hostname: config.tunnel.hostname,
			apiHostname: config.tunnel.apiHostname,
		});
	}

	if (method === "POST" && path === "/v1/pairing/claim") {
		const claim = parsePairingClaim(parseJson(bodyText));
		const current = await pairingStore.read();
		const next = applyClaim(current, claim);
		await pairingStore.write(next);
		return json(publicPairing(next));
	}

	if (method === "GET" && path === "/v1/pairing/credentials") {
		if (!isLoopback(url)) {
			throw new Error("pairing credentials are local-only");
		}
		const config = await store.read();
		return json(
			pairingCredentials(
				await pairingStore.read(),
				publicDeviceUrl(config.tunnel.apiHostname),
			),
		);
	}

	if (method === "POST" && path === "/v1/pairing/transfer") {
		const claim = parsePairingClaim(parseJson(bodyText));
		const current = await pairingStore.read();
		const next = applyTransfer(current, claim);
		await pairingStore.write(next);
		await wipeOwnerSecrets(secretsStore, revokeT3);
		return json(publicPairing(next));
	}

	if (method === "POST" && path === "/v1/pairing/unpair") {
		const body = parsePairingUnpair(parseJson(bodyText));
		const current = await pairingStore.read();
		const next = applyUnpair(current, body.uuid, body.key);
		await pairingStore.write(next);
		await wipeOwnerSecrets(secretsStore, revokeT3);
		return json(publicPairing(next));
	}

	if (method === "GET" && path === "/v1/config") {
		return json(redactDeviceConfig(await store.read()));
	}

	if (method === "PUT" && path === "/v1/config") {
		const body = asObject(parseJson(bodyText));
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

	if (method === "PUT" && path === "/v1/config/tunnel") {
		const current = await store.read();
		const next: DeviceConfig = {
			...current,
			tunnel: parseTunnelConfig(parseJson(bodyText)),
		};
		return persist(store, applyTunnel, next);
	}

	if (method === "GET" && path === "/v1/config/ai-key") {
		const secrets = await secretsStore.read();
		return json({ gpioAiKey: secrets.gpioAiKey });
	}

	if (method === "GET" && path === "/v1/config/secrets") {
		return json(secretsStatus(await secretsStore.read()));
	}

	if (method === "PUT" && path === "/v1/config/secrets") {
		const current = await secretsStore.read();
		const next = mergeDeviceSecrets(
			current,
			parseDeviceSecrets(parseJson(bodyText)),
		);
		await secretsStore.write(next);
		return json(secretsStatus(next));
	}

	if (method === "PUT" && path === "/v1/config/wifi") {
		const wifi = parseWifiConfig(parseJson(bodyText));
		const pairing = await pairingStore.read();
		if (!pairing.uuid || wifi.uuid !== pairing.uuid) {
			throw new Error("pairing uuid mismatch");
		}
		if (!applyWifi) {
			throw new Error("wifi apply is not configured");
		}
		try {
			const result = await applyWifi(wifi);
			return json(publicWifiStatus(result.ssid, true));
		} catch (error) {
			if (error instanceof WifiConnectError) {
				return json(publicWifiFailure(wifi.ssid, error.reason), 400);
			}
			throw error;
		}
	}

	if (method === "PUT" && path === "/v1/config/github") {
		const current = await secretsStore.read();
		const next = mergeDeviceSecrets(
			current,
			parseDeviceSecrets(parseJson(bodyText)),
		);
		if (!next.githubUsername || !next.githubToken) {
			throw new Error("githubUsername and githubToken are required");
		}
		await secretsStore.write(next);
		return json(secretsStatus(next));
	}

	if (method === "POST" && path === "/v1/t3/start") {
		if (!t3) {
			throw new Error("t3 is not configured");
		}
		const config = await store.read();
		if (!config.tunnel.hostname) {
			throw new Error("t3 hostname is not configured");
		}
		return json(await t3.start(config.tunnel.hostname));
	}

	if (method === "GET" && path === "/v1/t3/status") {
		if (!t3) {
			throw new Error("t3 is not configured");
		}
		return json(await t3.status());
	}

	if (method === "POST" && path === "/v1/t3/service-install") {
		if (!t3) {
			throw new Error("t3 is not configured");
		}
		return json(await t3.installService());
	}

	if (method === "GET" && path === "/v1/status") {
		const config = await store.read();
		const secrets = await secretsStore.read();
		const pairing = await pairingStore.read();
		const t3Status = t3
			? await t3.status()
			: {
					running: false,
					pairingUrl: "",
					pairingToken: "",
					paired: false,
					serviceInstalled: false,
				};
		return json({
			hardware: config.hardware,
			tunnel: {
				configured: Boolean(config.tunnel.token),
				hostname: config.tunnel.hostname,
				apiHostname: config.tunnel.apiHostname,
			},
			secrets: secretsStatus(secrets),
			pairing: publicPairing(pairing),
			t3codePairing: "dashboard",
			t3: t3Status,
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

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new Error("invalid json");
	}
}

function asObject(body: unknown): Record<string, unknown> {
	if (body === null || typeof body !== "object" || Array.isArray(body)) {
		throw new Error("body must be an object");
	}
	return body as Record<string, unknown>;
}

function json(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

function isLoopback(url: URL): boolean {
	return (
		url.hostname === "127.0.0.1" ||
		url.hostname === "localhost" ||
		url.hostname === "::1"
	);
}

async function wipeOwnerSecrets(
	secretsStore: SecretsStore,
	revokeT3: (() => Promise<void>) | undefined,
): Promise<void> {
	const current = await secretsStore.read();
	await secretsStore.write({
		...current,
		githubUrl: "",
		githubUsername: "",
		githubToken: "",
	});
	if (revokeT3) {
		await revokeT3();
	}
}
