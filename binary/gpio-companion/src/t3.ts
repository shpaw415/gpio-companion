import { existsSync, readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import {
	extractT3PairingToken,
	publicDeviceUrl,
	rewriteT3PairingUrl,
} from "gpio-companion";

export type T3Pairing = {
	pairingUrl: string;
	pairingToken: string;
};

export type T3Status = {
	running: boolean;
	pairingUrl: string;
	pairingToken: string;
	paired: boolean;
	serviceInstalled: boolean;
};

export type T3Controller = {
	pair(t3Hostname: string): Promise<T3Pairing>;
	status(): Promise<T3Status>;
	revoke(): Promise<void>;
};

const PAIR_WAIT_MS = 25_000;
const MINT_WAIT_MS = 45_000;
const STATUS_SPAWN_MS = 20_000;
const STATUS_CACHE_MS = 10_000;
const SERVICE_CACHE_MS = 5 * 60_000;

let lastPairingUrl = "";
let lastPairingToken = "";
let markedPaired = false;
let pairInFlight: Promise<T3Pairing> | null = null;
let statusInFlight: Promise<T3Status> | null = null;
let cachedStatus: { at: number; value: T3Status } | null = null;
let cachedService: { at: number; value: boolean } | null = null;

export function liveT3Controller(): T3Controller {
	return {
		pair: pairT3,
		status: t3Status,
		revoke: revokeT3Authorization,
	};
}

export async function pairT3(t3Hostname: string): Promise<T3Pairing> {
	if (pairInFlight) {
		return pairInFlight;
	}
	pairInFlight = runPair(t3Hostname).finally(() => {
		pairInFlight = null;
	});
	return pairInFlight;
}

async function runPair(t3Hostname: string): Promise<T3Pairing> {
	clearPairing();
	invalidateT3Status();
	const user = gpioUser();
	const minted = await mintPairing(user, t3Hostname).catch(() => null);
	if (minted?.pairingToken) {
		return rememberPairing(minted);
	}
	const raw = await spawnT3(user, ["pair"], PAIR_WAIT_MS).catch(() => "");
	return rememberPairing(pairingFromOutput(raw, t3Hostname));
}

export async function t3Status(): Promise<T3Status> {
	const now = Date.now();
	if (cachedStatus && now - cachedStatus.at < STATUS_CACHE_MS) {
		return withPairing(cachedStatus.value);
	}
	if (statusInFlight) {
		return statusInFlight.then(withPairing);
	}
	statusInFlight = loadT3Status().finally(() => {
		statusInFlight = null;
	});
	return statusInFlight;
}

export async function revokeT3Authorization(): Promise<void> {
	clearPairing();
	markedPaired = false;
	invalidateT3Status();
	const user = gpioUser();
	await spawnT3(user, ["logout"]).catch(() => undefined);
}

export function resetT3Runtime(): void {
	clearPairing();
	markedPaired = false;
	invalidateT3Status();
	pairInFlight = null;
}

async function loadT3Status(): Promise<T3Status> {
	if (pairInFlight) {
		return {
			running: true,
			pairingUrl: lastPairingUrl,
			pairingToken: lastPairingToken,
			paired: markedPaired,
			serviceInstalled: cachedService?.value ?? true,
		};
	}
	const user = gpioUser();
	const running = await portOpen(3773);
	const serviceInstalled = await cachedServiceInstalled(user, running);
	const paired = markedPaired || (await t3HasSession(user));
	if (paired) {
		markedPaired = true;
	}
	const value: T3Status = {
		running,
		pairingUrl: lastPairingUrl,
		pairingToken: lastPairingToken,
		paired,
		serviceInstalled,
	};
	cachedStatus = { at: Date.now(), value };
	return value;
}

function withPairing(status: T3Status): T3Status {
	return {
		...status,
		pairingUrl: lastPairingUrl,
		pairingToken: lastPairingToken,
		paired: markedPaired || status.paired,
	};
}

function invalidateT3Status(): void {
	cachedStatus = null;
	statusInFlight = null;
}

async function cachedServiceInstalled(
	user: string,
	running: boolean,
): Promise<boolean> {
	if (running) {
		cachedService = { at: Date.now(), value: true };
		return true;
	}
	const now = Date.now();
	if (cachedService && now - cachedService.at < SERVICE_CACHE_MS) {
		return cachedService.value;
	}
	const value = await t3ServiceInstalled(user);
	cachedService = { at: now, value };
	return value;
}

function gpioUser(): string {
	if (process.env.GPIO_USER?.trim()) {
		return process.env.GPIO_USER.trim();
	}
	return process.env.SUDO_USER?.trim() || "root";
}

function t3Bin(): string {
	return process.env.GPIO_COMPANION_T3 ?? Bun.which("t3") ?? "t3";
}

function runningAs(user: string): boolean {
	if (user === "root") {
		return typeof process.getuid === "function" && process.getuid() === 0;
	}
	try {
		return userInfo().username === user;
	} catch {
		return process.env.USER === user || process.env.LOGNAME === user;
	}
}

function t3Command(user: string, args: string[]): string[] {
	const bin = t3Bin();
	if (user === "root" || runningAs(user)) {
		return [bin, ...args];
	}
	const runtime = runtimeDir(user);
	const session = runtime
		? [
				`XDG_RUNTIME_DIR=${runtime}`,
				`DBUS_SESSION_BUS_ADDRESS=unix:path=${runtime}/bus`,
			]
		: [];
	return [
		"sudo",
		"-u",
		user,
		"-H",
		"env",
		"-u",
		"SUDO_USER",
		"-u",
		"SUDO_UID",
		"-u",
		"SUDO_GID",
		"-u",
		"SUDO_COMMAND",
		...session,
		bin,
		...args,
	];
}

function runtimeDir(user: string): string {
	if (user === "root") {
		return "/run/user/0";
	}
	const uid = uidFor(user);
	return uid ? `/run/user/${uid}` : "";
}

function uidFor(user: string): string {
	try {
		const text = readFileSync("/etc/passwd", "utf8");
		for (const line of text.split("\n")) {
			const [name, , uid] = line.split(":");
			if (name === user && uid) {
				return uid;
			}
		}
	} catch {
		return "";
	}
	return "";
}

function spawnCwd(user: string): string {
	const home = user === "root" ? homedir() : `/home/${user}`;
	return existsSync(home) ? home : process.cwd();
}

function spawnEnv(user: string): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = { ...process.env };
	const runtime = runtimeDir(user);
	if (runtime) {
		env.XDG_RUNTIME_DIR = runtime;
		env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${runtime}/bus`;
	}
	delete env.SUDO_USER;
	delete env.SUDO_UID;
	delete env.SUDO_GID;
	delete env.SUDO_COMMAND;
	return env;
}

function clearPairing(): void {
	lastPairingUrl = "";
	lastPairingToken = "";
}

function rememberPairing(pairing: T3Pairing): T3Pairing {
	if (!pairing.pairingUrl || !pairing.pairingToken) {
		throw new Error("t3 pair did not print a pairing token");
	}
	lastPairingUrl = pairing.pairingUrl;
	lastPairingToken = pairing.pairingToken;
	return pairing;
}

function pairingFromOutput(raw: string, t3Hostname: string): T3Pairing {
	const pairingToken = extractT3PairingToken(raw);
	return {
		pairingToken,
		pairingUrl: rewriteT3PairingUrl(raw, t3Hostname),
	};
}

async function mintPairing(
	user: string,
	t3Hostname: string,
): Promise<T3Pairing> {
	const baseUrl = publicDeviceUrl(t3Hostname);
	const stdout = await spawnT3(
		user,
		["auth", "pairing", "create", "--base-url", baseUrl, "--json"],
		MINT_WAIT_MS,
	).catch(() =>
		spawnT3(
			user,
			["auth", "pairing", "create", "--base-url", baseUrl],
			MINT_WAIT_MS,
		),
	);
	const pairing = pairingFromOutput(stdout, t3Hostname);
	if (pairing.pairingToken) {
		return pairing;
	}
	throw new Error("t3 pairing create did not print a pairing token");
}

async function spawnT3(
	user: string,
	args: string[],
	timeoutMs = PAIR_WAIT_MS,
): Promise<string> {
	const proc = Bun.spawn(t3Command(user, args), {
		cwd: spawnCwd(user),
		stdout: "pipe",
		stderr: "pipe",
		stdin: "ignore",
		env: spawnEnv(user),
	});
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		proc.kill();
	}, timeoutMs);
	try {
		const [stdout, stderr, code] = await Promise.all([
			readAll(proc.stdout),
			readAll(proc.stderr),
			proc.exited,
		]);
		const output = `${stdout}\n${stderr}`;
		if (code !== 0) {
			if (extractT3PairingToken(output)) {
				return output;
			}
			throw new Error(
				output.trim() ||
					(timedOut
						? `t3 ${args.join(" ")} timed out after ${timeoutMs}ms`
						: `t3 ${args.join(" ")} failed`),
			);
		}
		return output;
	} finally {
		clearTimeout(timeout);
	}
}

async function t3ServiceInstalled(user: string): Promise<boolean> {
	try {
		const output = await spawnT3(user, ["service", "status"], STATUS_SPAWN_MS);
		return /active|installed|running/i.test(output);
	} catch {
		return false;
	}
}

async function t3HasSession(user: string): Promise<boolean> {
	try {
		const output = await spawnT3(user, ["auth"], STATUS_SPAWN_MS);
		if (/no sessions?/i.test(output)) {
			return false;
		}
		return /session/i.test(output);
	} catch {
		return false;
	}
}

async function portOpen(port: number): Promise<boolean> {
	try {
		await fetch(`http://127.0.0.1:${port}/`, {
			signal: AbortSignal.timeout(400),
		});
		return true;
	} catch {
		return false;
	}
}

async function readAll(
	stream: ReadableStream<Uint8Array> | number | null,
): Promise<string> {
	if (!stream || typeof stream === "number") {
		return "";
	}
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let text = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			return text;
		}
		if (value) {
			text += decoder.decode(value, { stream: true });
		}
	}
}
