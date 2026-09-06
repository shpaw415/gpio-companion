import type { SignedDeviceEnvelope } from "gpio-companion";
import { isOfflineSignFallback, signWithStoredKey } from "./offline-keys.ts";

export async function withOfflineSign(
	uuid: string,
	online: () => Promise<SignedDeviceEnvelope>,
	local: { method: string; path: string; body?: string },
): Promise<SignedDeviceEnvelope> {
	try {
		return await online();
	} catch (error) {
		if (!isOfflineSignFallback(error)) {
			throw error;
		}
		return signWithStoredKey(uuid, local.method, local.path, local.body);
	}
}
