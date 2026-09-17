import {
	signVoiceTicket,
	type VoiceTicket,
	type VoiceTicketClaims,
	verifyVoiceTicket,
} from "gpio-companion";
import { requireOwnedDevice } from "./pairing-store.ts";

export type VoiceCredentialsEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
};

export async function issueVoiceTicket(
	env: VoiceCredentialsEnv,
	userId: string,
	uuid: string,
	origin?: string,
): Promise<VoiceTicket> {
	const device = await requireOwnedDevice(env.DYNAMIC_PAGE_KV, userId, uuid);
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	if (!device.deviceUrl.trim()) {
		throw new Error("device URL is missing");
	}
	return signVoiceTicket({
		privateKeyPem,
		uuid: device.uuid,
		userId,
		origin,
	});
}

export async function verifyVoiceAccessTicket(
	env: VoiceCredentialsEnv,
	token: string,
	uuid: string,
): Promise<VoiceTicketClaims> {
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	const claims = await verifyVoiceTicket({ token, privateKeyPem });
	if (claims.uuid !== uuid.trim()) {
		throw new Error("invalid voice token");
	}
	return claims;
}
