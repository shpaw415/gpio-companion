import {
	publicKeyPemFromPrivateKey,
	signEd25519Message,
	verifyEd25519Message,
} from "./device-auth.ts";

export const AI_TOKEN_PREFIX = "gpioai.v1.";
export const AI_TOKEN_TTL_MS = 60 * 60 * 1000;

export type AiAccessClaims = {
	uuid: string;
	exp: number;
};

export function isAiAccessToken(token: string): boolean {
	return token.trim().startsWith(AI_TOKEN_PREFIX);
}

export async function signAiAccessToken(options: {
	privateKeyPem: string;
	uuid: string;
	now?: number;
	ttlMs?: number;
}): Promise<{ token: string; expiresAt: string; exp: number }> {
	const uuid = options.uuid.trim();
	if (!uuid) {
		throw new Error("uuid is required");
	}
	const now = options.now ?? Date.now();
	const ttlMs = options.ttlMs ?? AI_TOKEN_TTL_MS;
	const exp = now + ttlMs;
	const payload = JSON.stringify({ uuid, exp } satisfies AiAccessClaims);
	const signature = await signEd25519Message(
		options.privateKeyPem,
		new TextEncoder().encode(payload),
	);
	return {
		token: `${AI_TOKEN_PREFIX}${bytesToBase64Url(new TextEncoder().encode(payload))}.${bytesToBase64Url(signature)}`,
		expiresAt: new Date(exp).toISOString(),
		exp,
	};
}

export async function verifyAiAccessToken(options: {
	token: string;
	publicKeyPem?: string;
	privateKeyPem?: string;
	now?: number;
}): Promise<AiAccessClaims> {
	const token = options.token.trim();
	if (!isAiAccessToken(token)) {
		throw new Error("invalid ai token");
	}
	const rest = token.slice(AI_TOKEN_PREFIX.length);
	const dot = rest.indexOf(".");
	if (dot <= 0 || dot === rest.length - 1) {
		throw new Error("invalid ai token");
	}
	let payloadBytes: Uint8Array;
	let signature: Uint8Array;
	try {
		payloadBytes = base64UrlToBytes(rest.slice(0, dot));
		signature = base64UrlToBytes(rest.slice(dot + 1));
	} catch {
		throw new Error("invalid ai token");
	}
	const publicKeyPem =
		options.publicKeyPem?.trim() ||
		(options.privateKeyPem
			? await publicKeyPemFromPrivateKey(options.privateKeyPem)
			: "");
	if (!publicKeyPem) {
		throw new Error("ai token key is not set");
	}
	const ok = await verifyEd25519Message(publicKeyPem, payloadBytes, signature);
	if (!ok) {
		throw new Error("invalid ai token");
	}
	let claims: AiAccessClaims;
	try {
		const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
			uuid?: unknown;
			exp?: unknown;
		};
		const uuid = typeof parsed.uuid === "string" ? parsed.uuid.trim() : "";
		const exp = Number(parsed.exp);
		if (!uuid || !Number.isFinite(exp)) {
			throw new Error("invalid ai token");
		}
		claims = { uuid, exp };
	} catch {
		throw new Error("invalid ai token");
	}
	const now = options.now ?? Date.now();
	if (now >= claims.exp) {
		throw new Error("expired ai token");
	}
	return claims;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const pad =
		padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	const binary = atob(padded + pad);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
