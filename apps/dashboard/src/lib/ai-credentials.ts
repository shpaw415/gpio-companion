import {
	isAiAccessToken,
	signAiAccessToken,
	timingSafeEqualString,
	verifyAiAccessToken,
} from "gpio-companion";
import { userIdForAiKey } from "./credits.ts";
import { loadDevices, pairOwnerKey } from "./pairing-store.ts";

export type AiCredentialsEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
};

export type AiAccessCreds = {
	token: string;
	expiresAt: string;
};

export function bearerToken(request: Request): string {
	const header = request.headers.get("authorization") ?? "";
	const match = header.match(/^Bearer\s+(\S+)/i);
	return match?.[1]?.trim() ?? "";
}

export async function issueAiCredentials(
	env: AiCredentialsEnv,
	uuid: string,
	key: string,
): Promise<AiAccessCreds> {
	const trimmed = uuid.trim();
	if (!trimmed || !key) {
		throw new Error("uuid and key are required");
	}
	const ownerId = await env.DYNAMIC_PAGE_KV.get(pairOwnerKey(trimmed));
	if (!ownerId) {
		throw new Error("unknown pairing");
	}
	const devices = await loadDevices(env.DYNAMIC_PAGE_KV, ownerId);
	const device = devices.find((item) => item.uuid === trimmed);
	if (!device || !timingSafeEqualString(device.key, key)) {
		throw new Error("pairing key mismatch");
	}
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	const minted = await signAiAccessToken({
		privateKeyPem,
		uuid: trimmed,
	});
	return { token: minted.token, expiresAt: minted.expiresAt };
}

export async function userIdForAiAuth(
	env: AiCredentialsEnv,
	token: string,
): Promise<string | null> {
	const key = token.trim();
	if (!key) {
		return null;
	}
	if (isAiAccessToken(key)) {
		const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
		if (!privateKeyPem.trim()) {
			return null;
		}
		try {
			const claims = await verifyAiAccessToken({
				token: key,
				privateKeyPem,
			});
			return env.DYNAMIC_PAGE_KV.get(pairOwnerKey(claims.uuid));
		} catch {
			return null;
		}
	}
	return userIdForAiKey(env.DYNAMIC_PAGE_KV, key);
}
