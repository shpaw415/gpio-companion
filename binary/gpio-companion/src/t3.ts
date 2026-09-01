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

const PAIR_WAIT_MS = 20_000;

let lastPairingUrl = "";
let lastPairingToken = "";
let markedPaired = false;

export function liveT3Controller(): T3Controller {
	return {
		pair: pairT3,
		status: t3Status,
		revoke: revokeT3Authorization,
	};
}

export async function pairT3(t3Hostname: string): Promise<T3Pairing> {
	clearPairing();
	const user = gpioUser();
	const raw = await spawnT3(user, ["pair"]).catch(() => "");
	const fromPair = pairingFromOutput(raw, t3Hostname);
	if (fromPair.pairingToken) {
		return rememberPairing(fromPair);
	}
	return rememberPairing(await mintPairing(user, t3Hostname));
}

export async function t3Status(): Promise<T3Status> {
	const user = gpioUser();
	const running = await portOpen(3773);
	const serviceInstalled = await t3ServiceInstalled(user);
	const paired = markedPaired || (await t3HasSession(user));
	if (paired) {
		markedPaired = true;
	}
	return {
		running,
		pairingUrl: lastPairingUrl,
		pairingToken: lastPairingToken,
		paired,
		serviceInstalled,
	};
}

export async function revokeT3Authorization(): Promise<void> {
	clearPairing();
	markedPaired = false;
	const user = gpioUser();
	await spawnT3(user, ["logout"]).catch(() => undefined);
}

function gpioUser(): string {
	if (process.env.GPIO_USER?.trim()) {
		return process.env.GPIO_USER.trim();
	}
	return process.env.SUDO_USER?.trim() || "root";
}

function t3Command(user: string, args: string[]): string[] {
	const bin = process.env.GPIO_COMPANION_T3 ?? Bun.which("t3") ?? "t3";
	if (user === "root") {
		return [bin, ...args];
	}
	return ["sudo", "-u", user, "-H", bin, ...args];
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
	const stdout = await spawnT3(user, [
		"auth",
		"pairing",
		"create",
		"--base-url",
		baseUrl,
		"--json",
	]).catch(() =>
		spawnT3(user, ["auth", "pairing", "create", "--base-url", baseUrl]),
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
		stdout: "pipe",
		stderr: "pipe",
		stdin: "ignore",
		env: process.env,
	});
	const timeout = setTimeout(() => proc.kill(), timeoutMs);
	try {
		const [stdout, stderr, code] = await Promise.all([
			readAll(proc.stdout),
			readAll(proc.stderr),
			proc.exited,
		]);
		const output = `${stdout}\n${stderr}`;
		if (code !== 0) {
			throw new Error(output.trim() || `t3 ${args.join(" ")} failed`);
		}
		return output;
	} finally {
		clearTimeout(timeout);
	}
}

async function t3ServiceInstalled(user: string): Promise<boolean> {
	try {
		const output = await spawnT3(user, ["service", "status"]);
		return /active|installed|running/i.test(output);
	} catch {
		return false;
	}
}

async function t3HasSession(user: string): Promise<boolean> {
	try {
		const output = await spawnT3(user, ["auth"]);
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
