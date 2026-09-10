#!/usr/bin/env bun
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createSignedEnvelope,
	DEFAULT_DASHBOARD_ORIGIN,
	DEFAULT_DEVICE_KEY_ID,
	type DeviceEndpointProbe,
	debugWsConnectUrl,
	deviceEndpointProbes,
	evaluateDeviceEndpointProbe,
	formatDebugLogLine,
	mintOfflineGrant,
	type OfflineGrantBundle,
	pairingUuidFromDeviceUrl,
	parseDebugEvent,
	parseDeviceEndpointBody,
	publicDeviceUrl,
	type SignedDeviceEnvelope,
	signDeviceRequest,
	signOfflineEnvelope,
} from "../packages/core/src/index.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const BLE_CENTRAL = join(SCRIPT_DIR, "ble-central.py");

function arg(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return undefined;
	}
	return process.argv[index + 1];
}

type Via = "all" | "http" | "ble";

function parseVia(value: string | undefined): Via {
	if (value === "http" || value === "ble" || value === "all") {
		return value;
	}
	return "all";
}

function wantsHttp(via: Via): boolean {
	return via === "all" || via === "http";
}

function wantsBle(via: Via): boolean {
	return via === "all" || via === "ble";
}

function probeAllowed(probe: DeviceEndpointProbe, via: Via): boolean {
	if (probe.via === "http") {
		return wantsHttp(via);
	}
	if (probe.via === "ble") {
		return wantsBle(via);
	}
	return true;
}

type Row = {
	name: string;
	state: "pass" | "fail" | "skipped";
	log: string;
};

async function loadKeys(keysDir: string, keyId: string) {
	const privatePath = join(keysDir, `${keyId}.private.pem`);
	const privateKeyPem = (await Bun.file(privatePath).text()).trim();
	if (!privateKeyPem) {
		throw new Error(`missing private key at ${privatePath}`);
	}
	return { keyId, privateKeyPem };
}

async function signedEnvelope(
	probe: DeviceEndpointProbe,
	uuid: string,
	keys: { keyId: string; privateKeyPem: string },
	offline: OfflineGrantBundle,
): Promise<SignedDeviceEnvelope> {
	const body = probe.body?.(uuid) ?? "";
	if (probe.auth === "offline" || probe.auth === "offline-deny") {
		return signOfflineEnvelope({
			bundle: offline,
			method: probe.method,
			path: probe.path,
			body,
		});
	}
	return createSignedEnvelope({
		privateKeyPem: keys.privateKeyPem,
		keyId: keys.keyId,
		method: probe.method,
		path: probe.path,
		body,
	});
}

async function httpSend(
	origin: string,
	probe: DeviceEndpointProbe,
	envelope: SignedDeviceEnvelope | null,
	uuid: string,
): Promise<{ status: number; raw: string }> {
	const headers = new Headers();
	if (envelope) {
		for (const [key, value] of Object.entries(envelope.headers)) {
			if (value) {
				headers.set(key, value);
			}
		}
	}
	const body = envelope?.body || probe.body?.(uuid) || "";
	if (body && probe.method !== "GET" && probe.method !== "HEAD") {
		headers.set("content-type", "application/json");
	}
	const response = await fetch(`${origin}${probe.path}`, {
		method: probe.method,
		headers,
		body:
			probe.method === "GET" || probe.method === "HEAD"
				? undefined
				: body || undefined,
	});
	return { status: response.status, raw: await response.text() };
}

class BleCentral {
	private proc: ReturnType<typeof Bun.spawn> | null = null;
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	private buffer = "";
	info: Record<string, unknown> | null = null;

	async start(python: string, uuid: string, timeoutSec: number) {
		this.proc = Bun.spawn(
			[
				python,
				"-u",
				BLE_CENTRAL,
				"--uuid",
				uuid,
				"--timeout",
				String(timeoutSec),
				"--scan-timeout",
				"20",
			],
			{ stdin: "pipe", stdout: "pipe", stderr: "pipe" },
		);
		this.reader = this.proc.stdout.getReader();
		const first = await this.readEvent(25_000);
		if (first.event === "error") {
			throw new Error(String(first.error ?? "ble connect failed"));
		}
		if (first.event !== "ready") {
			throw new Error("ble central did not become ready");
		}
		this.info =
			first.info && typeof first.info === "object"
				? (first.info as Record<string, unknown>)
				: {};
	}

	async send(envelope: SignedDeviceEnvelope): Promise<string> {
		this.write({ cmd: "send", envelope });
		const event = await this.readEvent(35_000);
		if (event.event === "error") {
			throw new Error(String(event.error ?? "ble send failed"));
		}
		if (event.event !== "result") {
			throw new Error("ble central returned an unexpected event");
		}
		return String(event.raw ?? "");
	}

	async close() {
		try {
			this.write({ cmd: "close" });
		} catch {
			// ignore
		}
		this.proc?.stdin.end();
		this.proc?.kill();
		await this.proc?.exited.catch(() => undefined);
	}

	private write(payload: unknown) {
		if (!this.proc) {
			throw new Error("ble central is not running");
		}
		this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
	}

	private async readEvent(timeoutMs: number): Promise<Record<string, unknown>> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const line = await this.readLine(deadline - Date.now());
			if (!line) {
				continue;
			}
			try {
				return JSON.parse(line) as Record<string, unknown>;
			} catch {
				throw new Error(`invalid ble central line: ${line}`);
			}
		}
		throw new Error("timed out waiting for ble central");
	}

	private async readLine(timeoutMs: number): Promise<string> {
		const deadline = Date.now() + timeoutMs;
		while (true) {
			const index = this.buffer.indexOf("\n");
			if (index !== -1) {
				const line = this.buffer.slice(0, index).trim();
				this.buffer = this.buffer.slice(index + 1);
				if (line) {
					return line;
				}
				continue;
			}
			if (!this.reader) {
				throw new Error("ble central stdout closed");
			}
			const remain = deadline - Date.now();
			if (remain <= 0) {
				throw new Error("timed out waiting for ble central");
			}
			const chunk = await Promise.race([
				this.reader.read(),
				sleep(remain).then(() => null),
			]);
			if (!chunk) {
				throw new Error("timed out waiting for ble central");
			}
			if (chunk.done) {
				throw new Error("ble central exited");
			}
			this.buffer += new TextDecoder().decode(chunk.value);
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function printRows(rows: Row[]) {
	for (const row of rows) {
		const mark =
			row.state === "pass" ? "PASS" : row.state === "fail" ? "FAIL" : "SKIP";
		console.log(`${mark}  ${row.name}${row.log ? `\n  ${row.log}` : ""}`);
	}
}

async function connectDebug(
	deviceUrl: string,
	keys: { keyId: string; privateKeyPem: string },
) {
	const headers = await signDeviceRequest({
		privateKeyPem: keys.privateKeyPem,
		keyId: keys.keyId,
		method: "GET",
		path: "/v1/debug",
	});
	const url = debugWsConnectUrl(deviceUrl, headers);
	const events: string[] = [];
	const ws = new WebSocket(url, {
		headers: { Origin: DEFAULT_DASHBOARD_ORIGIN },
	});
	const opened = new Promise<void>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("debug websocket timed out")),
			15_000,
		);
		ws.addEventListener("open", () => {
			clearTimeout(timer);
			resolve();
		});
		ws.addEventListener("error", () => {
			clearTimeout(timer);
			reject(new Error("debug websocket failed"));
		});
	});
	ws.addEventListener("message", (event) => {
		try {
			const value =
				typeof event.data === "string" ? JSON.parse(event.data) : event.data;
			const parsed = parseDebugEvent(value);
			if (!parsed) {
				return;
			}
			const line = formatDebugLogLine(parsed);
			events.push(line);
			console.log(`DEBUG  ${line}`);
		} catch {
			return;
		}
	});
	await opened;
	return {
		events,
		close() {
			ws.close();
		},
	};
}

const via = parseVia(arg("--via"));
const deviceUrl = publicDeviceUrl(
	arg("--device-url") ?? process.env.GPIO_COMPANION_DEVICE_URL ?? "",
);
if (!deviceUrl) {
	console.error("pass --device-url https://api-<slug>.gpio-companion.com/");
	process.exit(2);
}
const keysDir = arg("--keys") ?? join(REPO_ROOT, ".device-keys");
const keyId = arg("--key-id") ?? DEFAULT_DEVICE_KEY_ID;
const uuidArg = arg("--uuid") ?? pairingUuidFromDeviceUrl(deviceUrl);
if (!uuidArg) {
	console.error("could not derive pairing uuid; pass --uuid");
	process.exit(2);
}

const keys = await loadKeys(keysDir, keyId);
const rows: Row[] = [];
let failed = false;

console.log(`device: ${deviceUrl}`);
console.log(`uuid:   ${uuidArg}`);
console.log(`via:    ${via}`);
console.log(`keys:   ${keysDir}/${keyId}.private.pem`);

const debug = await connectDebug(deviceUrl, keys).catch((error: unknown) => {
	const message = error instanceof Error ? error.message : "debug ws failed";
	rows.push({
		name: "WebSocket /v1/debug",
		state: "fail",
		log: message,
	});
	failed = true;
	return null;
});
if (debug) {
	rows.push({
		name: "WebSocket /v1/debug",
		state: "pass",
		log: "connected",
	});
}

const offline = await mintOfflineGrant({
	masterPrivateKeyPem: keys.privateKeyPem,
	uuid: uuidArg,
	userId: "device-endpoint-runner",
});
console.log(`offline key: ${offline.grant.keyId} exp ${offline.grant.exp}`);

let ble: BleCentral | null = null;
if (wantsBle(via)) {
	ble = new BleCentral();
	try {
		const python =
			arg("--python") ?? process.env.GPIO_COMPANION_BLE_PYTHON ?? "python3";
		await ble.start(python, uuidArg, 30);
		const gatt = deviceEndpointProbes().find((item) => item.id === "gatt-info");
		if (gatt) {
			const verdict = evaluateDeviceEndpointProbe(gatt, {
				selectedUuid: uuidArg,
				body: ble.info,
			});
			rows.push({
				name: `ble ${gatt.name}`,
				state: verdict.pass ? "pass" : "fail",
				log: verdict.detail,
			});
			if (!verdict.pass) {
				failed = true;
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "ble failed";
		rows.push({
			name: "Bluetooth connect",
			state: "fail",
			log: message,
		});
		failed = true;
		await ble.close();
		ble = null;
	}
}

for (const probe of deviceEndpointProbes()) {
	if (probe.id === "gatt-info") {
		continue;
	}
	if (!probeAllowed(probe, via)) {
		rows.push({ name: probe.name, state: "skipped", log: `via ${probe.via}` });
		continue;
	}
	const transports: Array<"http" | "ble"> = [];
	if (probe.via !== "ble" && wantsHttp(via)) {
		transports.push("http");
	}
	if (probe.via !== "http" && wantsBle(via)) {
		transports.push("ble");
	}
	for (const transport of transports) {
		const name = `${transport} ${probe.name}`;
		if (transport === "ble" && !ble) {
			rows.push({
				name,
				state: "skipped",
				log: "no bluetooth session",
			});
			continue;
		}
		let lastFail = "";
		let passed = false;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const envelope =
					probe.auth === "none"
						? null
						: await signedEnvelope(probe, uuidArg, keys, offline);
				let status = 0;
				let raw = "";
				if (transport === "http") {
					const hit = await httpSend(deviceUrl, probe, envelope, uuidArg);
					status = hit.status;
					raw = hit.raw;
				} else if (envelope && ble) {
					raw = await ble.send(envelope);
				} else {
					rows.push({
						name,
						state: "skipped",
						log: "unsigned BLE CMD is not forwarded",
					});
					passed = true;
					break;
				}
				const verdict = evaluateDeviceEndpointProbe(probe, {
					selectedUuid: uuidArg,
					status,
					raw,
					body: parseDeviceEndpointBody(raw),
				});
				if (
					!verdict.pass &&
					/replayed device signature/i.test(verdict.detail) &&
					attempt === 0
				) {
					lastFail = verdict.detail;
					continue;
				}
				rows.push({
					name,
					state: verdict.pass ? "pass" : "fail",
					log: verdict.detail,
				});
				if (!verdict.pass) {
					failed = true;
				}
				passed = true;
				break;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "request failed";
				const verdict = evaluateDeviceEndpointProbe(probe, {
					selectedUuid: uuidArg,
					error: message,
				});
				if (
					!verdict.pass &&
					/replayed device signature/i.test(verdict.detail) &&
					attempt === 0
				) {
					lastFail = verdict.detail;
					continue;
				}
				rows.push({
					name,
					state: verdict.pass ? "pass" : "fail",
					log: verdict.detail,
				});
				if (!verdict.pass) {
					failed = true;
				}
				passed = true;
				break;
			}
		}
		if (!passed) {
			rows.push({
				name,
				state: "fail",
				log: lastFail || "request failed",
			});
			failed = true;
		}
	}
}

await sleep(1500);
if (debug && debug.events.length === 0) {
	rows.push({
		name: "WebSocket live events",
		state: "fail",
		log: "connected but received no debug events",
	});
	failed = true;
} else if (debug && debug.events.length > 0) {
	rows.push({
		name: "WebSocket live events",
		state: "pass",
		log: `${debug.events.length} events`,
	});
}

debug?.close();
await ble?.close();

console.log("");
printRows(rows);
const pass = rows.filter((row) => row.state === "pass").length;
const fail = rows.filter((row) => row.state === "fail").length;
const skip = rows.filter((row) => row.state === "skipped").length;
console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
if (failed || fail > 0) {
	process.exit(1);
}
