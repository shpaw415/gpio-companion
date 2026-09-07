import { sha256 } from "js-sha256";
import nacl from "tweetnacl";

const DEVICE_AUTH_VERSION = "gpio-companion-device-v1";

export type SignedDeviceEnvelope = {
	method: string;
	path: string;
	body: string;
	headers: {
		"X-Gpio-Key-Id": string;
		"X-Gpio-Timestamp": string;
		"X-Gpio-Nonce": string;
		"X-Gpio-Signature": string;
		"X-Gpio-Grant"?: string;
	};
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

function seedFromPkcs8(pem: string): Uint8Array {
	const der = pemToBytes(pem);
	if (der.length < 32) {
		throw new Error("invalid offline key");
	}
	return der.slice(der.length - 32);
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export async function signOfflineEnvelope(options: {
	privateKeyPem: string;
	grant: unknown;
	method: string;
	path: string;
	body?: string;
}): Promise<SignedDeviceEnvelope> {
	const body = options.body ?? "";
	const method = options.method.toUpperCase();
	const path = normalizePath(options.path);
	const timestamp = String(Date.now());
	const nonce = randomNonce();
	const hash = sha256(body);
	const payload = [
		DEVICE_AUTH_VERSION,
		method,
		path,
		timestamp,
		nonce,
		hash,
	].join("\n");
	const seed = seedFromPkcs8(options.privateKeyPem);
	const pair = nacl.sign.keyPair.fromSeed(seed);
	const signature = nacl.sign.detached(
		new TextEncoder().encode(payload),
		pair.secretKey,
	);
	const grantHeader = JSON.stringify(options.grant);
	const grant = options.grant as { keyId?: string };
	return {
		method,
		path,
		body,
		headers: {
			"X-Gpio-Key-Id": typeof grant.keyId === "string" ? grant.keyId : "",
			"X-Gpio-Timestamp": timestamp,
			"X-Gpio-Nonce": nonce,
			"X-Gpio-Signature": bytesToBase64(signature),
			"X-Gpio-Grant": grantHeader,
		},
		grant: options.grant,
	};
}
