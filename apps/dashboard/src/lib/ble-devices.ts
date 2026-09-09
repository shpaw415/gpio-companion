const DB_NAME = "gpio-companion-ble-devices";
const STORE = "devices";
const DB_VERSION = 1;

type StoredBleDevice = {
	uuid: string;
	id: string;
};

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
			reject(request.error ?? new Error("bluetooth device store failed"));
	});
}

export async function loadWebBleId(uuid: string): Promise<string> {
	const trimmed = uuid.trim();
	if (!trimmed || typeof indexedDB === "undefined") {
		return "";
	}
	const db = await openDb();
	try {
		const record = await new Promise<StoredBleDevice | null>(
			(resolve, reject) => {
				const request = db
					.transaction(STORE, "readonly")
					.objectStore(STORE)
					.get(trimmed);
				request.onsuccess = () =>
					resolve((request.result as StoredBleDevice | undefined) ?? null);
				request.onerror = () =>
					reject(request.error ?? new Error("bluetooth device read failed"));
			},
		);
		return record?.id?.trim() ?? "";
	} finally {
		db.close();
	}
}

export async function saveWebBleId(uuid: string, id: string): Promise<void> {
	const trimmedUuid = uuid.trim();
	const trimmedId = id.trim();
	if (!trimmedUuid || !trimmedId || typeof indexedDB === "undefined") {
		return;
	}
	const db = await openDb();
	try {
		await new Promise<void>((resolve, reject) => {
			const request = db
				.transaction(STORE, "readwrite")
				.objectStore(STORE)
				.put({ uuid: trimmedUuid, id: trimmedId });
			request.onsuccess = () => resolve();
			request.onerror = () =>
				reject(request.error ?? new Error("bluetooth device write failed"));
		});
	} finally {
		db.close();
	}
}
