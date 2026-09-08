import {
	type HubTicket,
	type HubTicketClaims,
	signHubTicket,
	timingSafeEqualString,
	verifyHubTicket,
} from "gpio-companion";
import { isAdmin } from "./auth/role.ts";
import { getLiveBoard } from "./debug-live.ts";
import {
	type DeviceActor,
	loadDevices,
	pairOwnerKey,
	requireAccessibleDevice,
} from "./pairing-store.ts";

export type HubCredentialsEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
};

export async function issueHubCredentials(
	env: HubCredentialsEnv,
	uuid: string,
	key: string,
	origin?: string,
): Promise<HubTicket> {
	const trimmed = uuid.trim();
	if (!trimmed || !key) {
		throw new Error("uuid and key are required");
	}
	const ownerId = await env.DYNAMIC_PAGE_KV.get(pairOwnerKey(trimmed));
	if (ownerId) {
		const devices = await loadDevices(env.DYNAMIC_PAGE_KV, ownerId);
		const device = devices.find((item) => item.uuid === trimmed);
		if (!device || !timingSafeEqualString(device.key, key)) {
			throw new Error("pairing key mismatch");
		}
	}
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	return signHubTicket({
		privateKeyPem,
		uuid: trimmed,
		role: "pi",
		origin,
	});
}

export async function issueDashboardHubTicket(
	env: HubCredentialsEnv,
	identity: DeviceActor,
	uuid: string,
	origin?: string,
): Promise<HubTicket> {
	const trimmed = uuid.trim();
	if (!trimmed) {
		throw new Error("uuid is required");
	}
	await assertHubDashboardAccess(env, identity, trimmed);
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	return signHubTicket({
		privateKeyPem,
		uuid: trimmed,
		role: "dashboard",
		origin,
	});
}

export async function verifyHubAccessTicket(
	env: HubCredentialsEnv,
	token: string,
	uuid: string,
): Promise<HubTicketClaims> {
	const privateKeyPem = env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		throw new Error("GPIO_COMPANION_DEVICE_PRIVATE_KEY is not set");
	}
	const claims = await verifyHubTicket({ token, privateKeyPem });
	if (claims.uuid !== uuid.trim()) {
		throw new Error("invalid hub token");
	}
	return claims;
}

export async function verifyPiHubTicket(
	env: HubCredentialsEnv,
	token: string,
	uuid: string,
): Promise<void> {
	const claims = await verifyHubAccessTicket(env, token, uuid);
	if (claims.role !== "pi") {
		throw new Error("invalid hub token");
	}
}

export async function assertHubDashboardAccess(
	env: HubCredentialsEnv,
	identity: DeviceActor,
	uuid: string,
): Promise<void> {
	try {
		await requireAccessibleDevice(env.DYNAMIC_PAGE_KV, identity, uuid);
	} catch (caught) {
		if (
			isAdmin(identity.role) &&
			(await getLiveBoard(env.DYNAMIC_PAGE_KV, uuid))
		) {
			return;
		}
		throw caught;
	}
}
