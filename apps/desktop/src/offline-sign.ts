const DEVICE_AUTH_VERSION = "gpio-companion-device-v1";

export type OfflineGrantBundle = {
	uuid: string;
	privateKeyPem: string;
	grant: {
		keyId: string;
		exp: number;
		[key: string]: unknown;
	};
	exp: number;
};

export type SignedDeviceEnvelope = {
	method: string;
	path: string;
	body: string;
	headers: Record<string, string>;
	grant?: unknown;
};

function normalizePath(path: string): string {
	const url = path.includes("://")
		? new URL(path)
		: new URL(path.startsWith("/") ? path : `/${path}`, "http://device.local");
	return url.pathname.replace(/\/+$/, "") || "/";
}

function randomNonce(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pemToBytes(pem: string): Uint8Array {
	const b64 = pem
		.replace(/-----BEGIN [^-]+-----/, "")
		.replace(/-----END [^-]+-----/, "")
		.replace(/\s+/g, "");
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(body: string): Promise<string> {
	const hash = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(body),
	);
	return bytesToHex(new Uint8Array(hash));
}

export async function signOfflineEnvelope(options: {
	bundle: OfflineGrantBundle;
	method: string;
	path: string;
	body?: string;
}): Promise<SignedDeviceEnvelope> {
	const body = options.body ?? "";
	const method = options.method.toUpperCase();
	const path = normalizePath(options.path);
	const timestamp = String(Date.now());
	const nonce = randomNonce();
	const payload = [
		DEVICE_AUTH_VERSION,
		method,
		path,
		timestamp,
		nonce,
		await sha256Hex(body),
	].join("\n");
	const key = await crypto.subtle.importKey(
		"pkcs8",
		pemToBytes(options.bundle.privateKeyPem) as BufferSource,
		"Ed25519",
		false,
		["sign"],
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(payload)),
	);
	const grantHeader = JSON.stringify(options.bundle.grant);
	return {
		method,
		path,
		body,
		headers: {
			"X-Gpio-Key-Id": options.bundle.grant.keyId,
			"X-Gpio-Timestamp": timestamp,
			"X-Gpio-Nonce": nonce,
			"X-Gpio-Signature": bytesToBase64(signature),
			"X-Gpio-Grant": grantHeader,
		},
		grant: options.bundle.grant,
	};
}

export function isOfflineSignFallback(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /network|failed to fetch|offline|timed out|error sending|dns|connection refused/i.test(
		message,
	);
}

export function shouldMintOfflineKey(record: OfflineGrantBundle | null, now = Date.now()) {
	if (!record) {
		return true;
	}
	return record.exp - now <= 60 * 60 * 1000;
}

export function offlineKeyLabel(record: OfflineGrantBundle | null, now = Date.now()) {
	if (!record) {
		return "Offline BLE key not issued";
	}
	if (record.exp <= now) {
		return "Offline BLE key expired";
	}
	const hours = Math.max(0, Math.floor((record.exp - now) / 3_600_000));
	return `Offline BLE · ${hours}h left`;
}
