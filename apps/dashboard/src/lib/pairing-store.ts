import { isAdmin, type UserRole } from "./auth/role.ts";

export const DEVICE_LABEL_MAX = 40;

export type StoredPairing = {
	userId: string;
	uuid: string;
	key: string;
	deviceUrl: string;
	login: string;
	email: string;
	claimedAt: string;
	label: string;
};

export type PairingKv = {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
	list?(options: { prefix: string; cursor?: string }): Promise<{
		keys: Array<{ name: string }>;
		list_complete: boolean;
		cursor?: string;
	}>;
};

export type DeviceActor = {
	id: string;
	role: UserRole;
};

export type PublicPairing = Omit<StoredPairing, "key">;

export function deviceListKey(userId: string): string {
	return `device:${userId}`;
}

export function pairOwnerKey(uuid: string): string {
	return `pair:${uuid}`;
}

export function normalizeDeviceLabel(value: unknown): string {
	if (typeof value !== "string") {
		return "";
	}
	return value.trim().slice(0, DEVICE_LABEL_MAX);
}

export function deviceDisplayName(device: {
	label?: string;
	uuid: string;
}): string {
	const label = device.label?.trim() ?? "";
	return label || device.uuid;
}

export function asStoredPairing(value: unknown): StoredPairing {
	if (!value || typeof value !== "object") {
		throw new Error("invalid pairing");
	}
	const parsed = value as StoredPairing & { giteaLogin?: string };
	if (typeof parsed.uuid !== "string" || !parsed.uuid.trim()) {
		throw new Error("invalid pairing");
	}
	return {
		userId: String(parsed.userId ?? ""),
		uuid: parsed.uuid.trim(),
		key: String(parsed.key ?? ""),
		deviceUrl: String(parsed.deviceUrl ?? ""),
		login: parsed.login || parsed.giteaLogin || "",
		email: String(parsed.email ?? ""),
		claimedAt: String(parsed.claimedAt ?? ""),
		label: normalizeDeviceLabel(parsed.label),
	};
}

export function parseStoredPairing(raw: string): StoredPairing {
	return asStoredPairing(JSON.parse(raw));
}

export function parseDeviceList(raw: string | null): StoredPairing[] {
	if (!raw) {
		return [];
	}
	const parsed: unknown = JSON.parse(raw);
	if (Array.isArray(parsed)) {
		return parsed.map(asStoredPairing);
	}
	return [asStoredPairing(parsed)];
}

export async function loadDevices(
	kv: PairingKv,
	userId: string,
): Promise<StoredPairing[]> {
	const key = deviceListKey(userId);
	const raw = await kv.get(key);
	const devices = parseDeviceList(raw);
	if (raw && !Array.isArray(JSON.parse(raw))) {
		await kv.put(key, JSON.stringify(devices));
	}
	return devices;
}

export async function upsertDevice(
	kv: PairingKv,
	pairing: StoredPairing,
): Promise<StoredPairing[]> {
	const devices = await loadDevices(kv, pairing.userId);
	const next = [
		...devices.filter((device) => device.uuid !== pairing.uuid),
		pairing,
	];
	await kv.put(deviceListKey(pairing.userId), JSON.stringify(next));
	await kv.put(pairOwnerKey(pairing.uuid), pairing.userId);
	return next;
}

export async function removeDevice(
	kv: PairingKv,
	userId: string,
	uuid: string,
): Promise<StoredPairing | null> {
	const trimmed = uuid.trim();
	const devices = await loadDevices(kv, userId);
	const found = devices.find((device) => device.uuid === trimmed) ?? null;
	const next = devices.filter((device) => device.uuid !== trimmed);
	if (next.length === 0) {
		await kv.delete(deviceListKey(userId));
	} else {
		await kv.put(deviceListKey(userId), JSON.stringify(next));
	}
	await kv.delete(pairOwnerKey(trimmed));
	return found;
}

export async function findDeviceByUuid(
	kv: PairingKv,
	uuid?: string,
): Promise<StoredPairing> {
	const trimmed = uuid?.trim() ?? "";
	if (!trimmed) {
		throw new Error("uuid is required");
	}
	const ownerId = await kv.get(pairOwnerKey(trimmed));
	if (!ownerId) {
		throw new Error("device is not paired with this account");
	}
	const devices = await loadDevices(kv, ownerId);
	const device = devices.find((item) => item.uuid === trimmed);
	if (!device) {
		throw new Error("device is not paired with this account");
	}
	return device;
}

export async function clearPendingForUuid(
	kv: PairingKv,
	uuid: string,
	ownerId: string,
): Promise<void> {
	const trimmed = uuid.trim();
	await kv.delete(`pending:${trimmed}`);
	const inboxKey = `inbox:${ownerId}`;
	const inboxRaw = await kv.get(inboxKey);
	if (!inboxRaw) {
		return;
	}
	const inbox = JSON.parse(inboxRaw) as string[];
	const next = inbox.filter((id) => id !== trimmed);
	if (next.length === 0) {
		await kv.delete(inboxKey);
		return;
	}
	await kv.put(inboxKey, JSON.stringify(next));
}

export async function transferDeviceRecord(
	kv: PairingKv,
	device: StoredPairing,
	nextOwner: {
		userId: string;
		email: string;
		login: string;
		key?: string;
	},
): Promise<StoredPairing> {
	const fromId = device.userId;
	await clearPendingForUuid(kv, device.uuid, fromId);
	await removeDevice(kv, fromId, device.uuid);
	const next: StoredPairing = {
		...device,
		userId: nextOwner.userId,
		email: nextOwner.email,
		login: nextOwner.login,
		key: nextOwner.key ?? device.key,
		claimedAt: new Date().toISOString(),
	};
	await upsertDevice(kv, next);
	return next;
}

export async function updateDeviceLabel(
	kv: PairingKv,
	userId: string,
	uuid: string,
	label: string,
): Promise<StoredPairing> {
	const device = await requireOwnedDevice(kv, userId, uuid);
	const next = { ...device, label: normalizeDeviceLabel(label) };
	await upsertDevice(kv, next);
	return next;
}

export async function updateDeviceLabelByUuid(
	kv: PairingKv,
	uuid: string,
	label: string,
): Promise<StoredPairing> {
	const device = await findDeviceByUuid(kv, uuid);
	const next = { ...device, label: normalizeDeviceLabel(label) };
	await upsertDevice(kv, next);
	return next;
}

export async function requireOwnedDevice(
	kv: PairingKv,
	userId: string,
	uuid?: string,
): Promise<StoredPairing> {
	const devices = await loadDevices(kv, userId);
	if (devices.length === 0) {
		throw new Error("pair a device first");
	}
	const trimmed = uuid?.trim() ?? "";
	if (!trimmed) {
		if (devices.length !== 1) {
			throw new Error("uuid is required");
		}
		return requirePairOwner(kv, userId, devices[0] as StoredPairing);
	}
	const device = devices.find((item) => item.uuid === trimmed);
	if (!device) {
		throw new Error("device is not paired with this account");
	}
	return requirePairOwner(kv, userId, device);
}

async function requirePairOwner(
	kv: PairingKv,
	userId: string,
	device: StoredPairing,
): Promise<StoredPairing> {
	const ownerId = await kv.get(pairOwnerKey(device.uuid));
	if (ownerId !== userId) {
		throw new Error("device is not paired with this account");
	}
	return device;
}

export function publicPairing(device: StoredPairing): PublicPairing {
	const { key: _key, ...rest } = device;
	return rest;
}

export async function listAllDevices(kv: PairingKv): Promise<StoredPairing[]> {
	if (!kv.list) {
		throw new Error("kv list is required");
	}
	const devices: StoredPairing[] = [];
	let cursor: string | undefined;
	do {
		const page = await kv.list({ prefix: "device:", cursor });
		for (const key of page.keys) {
			devices.push(...parseDeviceList(await kv.get(key.name)));
		}
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	return devices;
}

export async function requireAccessibleDevice(
	kv: PairingKv,
	actor: DeviceActor,
	uuid?: string,
): Promise<StoredPairing> {
	const trimmed = uuid?.trim() ?? "";
	if (isAdmin(actor.role) && trimmed) {
		return findDeviceByUuid(kv, trimmed);
	}
	return requireOwnedDevice(kv, actor.id, uuid);
}
