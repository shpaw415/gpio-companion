export type StoredPairing = {
	userId: string;
	uuid: string;
	key: string;
	deviceUrl: string;
	login: string;
	email: string;
	claimedAt: string;
};

export type PairingKv = {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
};

export function deviceListKey(userId: string): string {
	return `device:${userId}`;
}

export function pairOwnerKey(uuid: string): string {
	return `pair:${uuid}`;
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
