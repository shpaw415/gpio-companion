import {
	type OfflineGrant,
	type OfflineGrantBundle,
	offlineGrantNeedsRefresh,
	type SignedDeviceEnvelope,
	signOfflineEnvelope,
} from "gpio-companion";

const DB_NAME = "gpio-companion";
const STORE = "offline-keys";
const DB_VERSION = 1;

export type StoredOfflineKey = OfflineGrantBundle & { uuid: string };

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: "uuid" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("offline key store failed"));
	});
}

export async function loadOfflineKey(
	uuid: string,
): Promise<StoredOfflineKey | null> {
	const trimmed = uuid.trim();
	if (!trimmed || typeof indexedDB === "undefined") {
		return null;
	}
	const db = await openDb();
	try {
		return await new Promise((resolve, reject) => {
			const request = db
				.transaction(STORE, "readonly")
				.objectStore(STORE)
				.get(trimmed);
			request.onsuccess = () =>
				resolve((request.result as StoredOfflineKey | undefined) ?? null);
			request.onerror = () =>
				reject(request.error ?? new Error("offline key read failed"));
		});
	} finally {
		db.close();
	}
}

export async function saveOfflineKey(record: StoredOfflineKey): Promise<void> {
	if (typeof indexedDB === "undefined") {
		return;
	}
	const db = await openDb();
	try {
		await new Promise<void>((resolve, reject) => {
			const request = db
				.transaction(STORE, "readwrite")
				.objectStore(STORE)
				.put(record);
			request.onsuccess = () => resolve();
			request.onerror = () =>
				reject(request.error ?? new Error("offline key write failed"));
		});
	} finally {
		db.close();
	}
}

export async function clearOfflineKeys(): Promise<void> {
	if (typeof indexedDB === "undefined") {
		return;
	}
	const db = await openDb();
	try {
		await new Promise<void>((resolve, reject) => {
			const request = db
				.transaction(STORE, "readwrite")
				.objectStore(STORE)
				.clear();
			request.onsuccess = () => resolve();
			request.onerror = () =>
				reject(request.error ?? new Error("offline key clear failed"));
		});
	} finally {
		db.close();
	}
}

export function liveOfflineBundle(
	record: StoredOfflineKey | null,
	now = Date.now(),
): OfflineGrantBundle | null {
	if (!record || record.grant.exp <= now) {
		return null;
	}
	return {
		privateKeyPem: record.privateKeyPem,
		grant: record.grant,
		exp: record.exp,
	};
}

export function offlineKeyLabel(
	grant: OfflineGrant | undefined,
	now = Date.now(),
): string {
	if (!grant) {
		return "Offline BLE key not issued";
	}
	const hours = Math.max(0, Math.floor((grant.exp - now) / 3_600_000));
	if (grant.exp <= now) {
		return "Offline BLE key expired";
	}
	return `Offline BLE · ${hours}h left`;
}

export function shouldMintOfflineKey(
	record: StoredOfflineKey | null,
	now = Date.now(),
): boolean {
	if (!record) {
		return true;
	}
	return offlineGrantNeedsRefresh(record.grant, now);
}

export async function signWithStoredKey(
	uuid: string,
	method: string,
	path: string,
	body?: string,
): Promise<SignedDeviceEnvelope> {
	const bundle = liveOfflineBundle(await loadOfflineKey(uuid));
	if (!bundle) {
		throw new Error("Go online once to issue a 24h Bluetooth key");
	}
	return signOfflineEnvelope({ bundle, method, path, body });
}

export function isOfflineSignFallback(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /failed to fetch|network|offline|could not reach|load failed|fetch failed|connection/i.test(
		message,
	);
}
