import { readFileSync } from "node:fs";
import {
	capLogText,
	DEBUG_PATH,
	DEFAULT_DEVICE_MAX_SKEW_MS,
	DeviceAuthError,
	type DeviceConfig,
	type DiskStats,
	debugAuthHeadersFromRequest,
	LOGS_PATH,
	LOGS_SINCE_HOURS,
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
	redactLogText,
	secretsStatus,
	UPDATE_PATH,
	VERSION,
	verifyDeviceRequest,
	WifiConnectError,
} from "gpio-companion";
import { readBoardModel } from "./board-model.ts";
import { createDebugHub } from "./debug.ts";
import { readDiskStats } from "./disk.ts";
import type { GithubInstallationCreds } from "./github-credentials.ts";
import { readJournalLogs } from "./logs.ts";
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
import type { ApplyUpdate } from "./update.ts";
import type { ApplyWifi } from "./wifi.ts";

export type DeviceAuthConfig = {
	keyId: string;
	publicKeyPem: string;
};

export type ApplyClock = (issuedMs: number) => Promise<void>;

export type ServeOptions = {
	port?: number;
	hostname?: string;
	store: ConfigStore;
	secrets: SecretsStore;
	pairing: PairingStore;
	applyTunnel: ApplyTunnel;
	applyWifi?: ApplyWifi;
	applyUpdate?: ApplyUpdate;
	revokeT3?: () => Promise<void>;
	t3?: T3Controller;
	deviceAuth: DeviceAuthConfig;
	githubCredentials?: () => Promise<GithubInstallationCreds>;
	applyClock?: ApplyClock;
	clockStampPath?: string;
	clockTrusted?: () => boolean | Promise<boolean>;
	noncePath?: string;
	nonceStore?: {
		has(nonce: string): boolean;
		add(nonce: string): void;
	};
	dashboardUrl?: string;
	readDisk?: () => DiskStats | null;
	readLogs?: () => Promise<string>;
};

export type DeviceRequestExtras = {
	readDisk?: () => DiskStats | null;
	readLogs?: () => Promise<string>;
	applyUpdate?: ApplyUpdate;
};

export function startDeviceApi(options: ServeOptions) {
	const port = options.port ?? DEFAULT_PORT;
	const hostname = options.hostname ?? "0.0.0.0";
	const clock = createClockGate(options);
	const nonces = createNonceGate(options);
	const debug = createDebugHub({
		dashboardUrl:
			options.dashboardUrl ?? process.env.GPIO_COMPANION_DASHBOARD_URL,
	});
	const extras: DeviceRequestExtras = {
		readDisk: options.readDisk ?? readDiskStats,
		readLogs: options.readLogs ?? readJournalLogs,
		applyUpdate: options.applyUpdate,
	};
	return Bun.serve({
		port,
		hostname,
		async fetch(request, server) {
			if (request.method === "OPTIONS") {
				return new Response(null, { status: 204 });
			}
			const url = new URL(request.url);
			const path = url.pathname.replace(/\/+$/, "") || "/";
			const upgrade = request.headers.get("upgrade")?.toLowerCase() ?? "";
			if (upgrade === "websocket" && path !== DEBUG_PATH) {
				console.error(`gpio-companion debug: websocket to ${path}`);
			}
			if (request.method === "GET" && path === DEBUG_PATH) {
				const origin = request.headers.get("origin") ?? "";
				console.log(
					`gpio-companion debug: handshake origin=${origin || "-"} upgrade=${upgrade || "-"}`,
				);
				if (!debug.allowOrigin(origin)) {
					console.error(`gpio-companion debug: unauthorized origin ${origin}`);
					return Response.json(
						{ error: "unauthorized debug origin" },
						{ status: 401 },
					);
				}
				if (!options.deviceAuth.publicKeyPem.trim()) {
					console.error(
						"gpio-companion debug: device public key not registered",
					);
					return Response.json(
						{ error: "device public key not registered" },
						{ status: 401 },
					);
				}
				try {
					const trusted = await clock.trusted();
					const verified = await verifyDeviceRequest({
						publicKeyPem: options.deviceAuth.publicKeyPem,
						keyId: options.deviceAuth.keyId,
						method: "GET",
						path: DEBUG_PATH,
						body: "",
						headers: debugAuthHeadersFromRequest(request),
						enforceSkew: trusted,
					});
					nonces.consume(verified.nonce);
					await clock.sync(verified.issued, verified.clockBehind);
				} catch (error) {
					if (error instanceof DeviceAuthError) {
						console.error(`gpio-companion debug: ${error.message}`);
						return Response.json(
							{ error: error.message },
							{ status: error.status },
						);
					}
					throw error;
				}
				if (server.upgrade(request)) {
					return undefined as never;
				}
				console.error("gpio-companion debug: upgrade failed");
				return new Response("upgrade failed", { status: 400 });
			}
			let response: Response;
			try {
				response = await handleDeviceRequest(
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
					clock,
					nonces,
					extras,
				);
			} catch (error) {
				if (error instanceof DeviceAuthError) {
					response = Response.json(
						{ error: error.message },
						{ status: error.status },
					);
				} else {
					const message =
						error instanceof Error ? error.message : "request failed";
					const status =
						message.includes("mismatch") ||
						message.includes("already paired") ||
						message.includes("local-only")
							? 403
							: 400;
					response = Response.json({ error: message }, { status });
				}
			}
			void debug.publishFromResponse(request, response);
			return response;
		},
		websocket: {
			open(ws) {
				debug.add(ws);
			},
			message() {},
			close(ws) {
				debug.remove(ws);
			},
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
	clock?: ClockGate,
	nonces?: NonceGate,
	extras?: DeviceRequestExtras,
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

	const trusted = clock ? await clock.trusted() : true;
	const verified = await verifyDeviceRequest({
		publicKeyPem: deviceAuth.publicKeyPem,
		keyId: deviceAuth.keyId,
		method,
		path,
		body: bodyText,
		headers: request.headers,
		enforceSkew: trusted,
	});
	if (nonces) {
		nonces.consume(verified.nonce);
	}
	if (clock) {
		await clock.sync(verified.issued, verified.clockBehind);
	} else if (verified.clockBehind) {
		throw new DeviceAuthError("expired device signature", 403);
	}

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

	if (
		method === "POST" &&
		(path === "/v1/t3/pair" || path === "/v1/t3/start")
	) {
		if (!t3) {
			throw new Error("t3 is not configured");
		}
		const config = await store.read();
		if (!config.tunnel.hostname) {
			throw new Error("t3 hostname is not configured");
		}
		return json(await t3.pair(config.tunnel.hostname));
	}

	if (method === "GET" && path === "/v1/t3/status") {
		if (!t3) {
			throw new Error("t3 is not configured");
		}
		return json(await t3.status());
	}

	if (method === "GET" && path === LOGS_PATH) {
		const raw = extras?.readLogs ? await extras.readLogs() : "";
		return json({
			text: capLogText(redactLogText(raw)),
			sinceHours: LOGS_SINCE_HOURS,
		});
	}

	if (method === "POST" && path === UPDATE_PATH) {
		if (!extras?.applyUpdate) {
			throw new Error("update is not configured");
		}
		await extras.applyUpdate();
		return json({ started: true });
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
		const disk = extras?.readDisk ? extras.readDisk() : null;
		return json({
			hardware: config.hardware,
			model: readBoardModel(),
			tunnel: {
				configured: Boolean(config.tunnel.token),
				hostname: config.tunnel.hostname,
				apiHostname: config.tunnel.apiHostname,
			},
			secrets: secretsStatus(secrets),
			pairing: publicPairing(pairing),
			t3codePairing: "dashboard",
			t3: t3Status,
			disk: disk ?? undefined,
		});
	}

	return json({ error: "not found" }, 404);
}

type ClockGate = {
	trusted(): Promise<boolean>;
	sync(issuedMs: number, clockBehind: boolean): Promise<void>;
};

type NonceGate = {
	consume(nonce: string): void;
};

const MAX_DEVICE_NONCES = 512;

function createClockGate(options: ServeOptions): ClockGate {
	let lastIssuedMs = readClockStamp(options.clockStampPath);
	const apply = options.applyClock ?? defaultApplyClock;
	return {
		async trusted() {
			if (options.clockTrusted) {
				return options.clockTrusted();
			}
			if (
				lastIssuedMs > 0 &&
				Math.abs(Date.now() - lastIssuedMs) <= DEFAULT_DEVICE_MAX_SKEW_MS
			) {
				return true;
			}
			return ntpSynchronized();
		},
		async sync(issuedMs, clockBehind) {
			if (!clockBehind) {
				return;
			}
			if (issuedMs <= lastIssuedMs) {
				throw new DeviceAuthError("expired device signature", 403);
			}
			try {
				await apply(issuedMs);
			} catch {
				// still accept this request; signature already verified
			}
			lastIssuedMs = issuedMs;
			writeClockStamp(options.clockStampPath, issuedMs);
		},
	};
}

function createNonceGate(options: ServeOptions): NonceGate {
	if (options.nonceStore) {
		const store = options.nonceStore;
		return {
			consume(nonce) {
				if (store.has(nonce)) {
					throw new DeviceAuthError("replayed device signature", 403);
				}
				store.add(nonce);
			},
		};
	}
	let nonces = readNonces(options.noncePath);
	return {
		consume(nonce) {
			if (nonces.includes(nonce)) {
				throw new DeviceAuthError("replayed device signature", 403);
			}
			nonces.push(nonce);
			if (nonces.length > MAX_DEVICE_NONCES) {
				nonces = nonces.slice(-MAX_DEVICE_NONCES);
			}
			writeNonces(options.noncePath, nonces);
		},
	};
}

async function defaultApplyClock(issuedMs: number): Promise<void> {
	const unix = Math.floor(issuedMs / 1000);
	if (!Number.isFinite(unix) || unix <= 0) {
		return;
	}
	try {
		const date = Bun.spawn(["date", "-u", "-s", `@${unix}`], {
			stdout: "ignore",
			stderr: "ignore",
		});
		await date.exited;
	} catch {
		return;
	}
	try {
		const hw = Bun.spawn(["fake-hwclock", "save"], {
			stdout: "ignore",
			stderr: "ignore",
		});
		await hw.exited;
	} catch {
		return;
	}
}

function readClockStamp(path: string | undefined): number {
	if (!path) {
		return 0;
	}
	try {
		const issued = Number(readFileSync(path, "utf8").trim());
		return Number.isFinite(issued) && issued > 0 ? issued : 0;
	} catch {
		return 0;
	}
}

function writeClockStamp(path: string | undefined, issuedMs: number): void {
	if (!path) {
		return;
	}
	void Bun.write(path, `${issuedMs}\n`).catch(() => undefined);
}

async function ntpSynchronized(): Promise<boolean> {
	try {
		const proc = Bun.spawn(
			["timedatectl", "show", "-p", "NTPSynchronized", "--value"],
			{ stdout: "pipe", stderr: "ignore" },
		);
		const text = await new Response(proc.stdout).text();
		await proc.exited;
		return text.trim().toLowerCase() === "yes";
	} catch {
		return false;
	}
}

function readNonces(path: string | undefined): string[] {
	if (!path) {
		return [];
	}
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((item): item is string => typeof item === "string");
	} catch {
		return [];
	}
}

function writeNonces(path: string | undefined, nonces: string[]): void {
	if (!path) {
		return;
	}
	void Bun.write(path, `${JSON.stringify(nonces)}\n`).catch(() => undefined);
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
