const KEY = "gpio-companion-ble-ids";
const memory = new Map<string, string>();

type Store = {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
};

let native: Store | null | undefined;

async function store(): Promise<Store> {
	if (native !== undefined) {
		return native ?? memoryStore();
	}
	try {
		const mod = await import("expo-secure-store");
		native = {
			getItem: (key) => mod.getItemAsync(key),
			setItem: (key, value) => mod.setItemAsync(key, value),
		};
		return native;
	} catch {
		native = null;
		return memoryStore();
	}
}

function memoryStore(): Store {
	return {
		getItem: async (key) => memory.get(key) ?? null,
		setItem: async (key, value) => {
			memory.set(key, value);
		},
	};
}

function parseMap(raw: string | null): Record<string, string> {
	if (!raw) {
		return {};
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		return parsed as Record<string, string>;
	} catch {
		return {};
	}
}

async function readMap(): Promise<Record<string, string>> {
	return parseMap(await (await store()).getItem(KEY));
}

async function writeMap(map: Record<string, string>): Promise<void> {
	await (await store()).setItem(KEY, JSON.stringify(map));
}

export async function loadLocalBleId(uuid: string): Promise<string> {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return "";
	}
	return (await readMap())[trimmed]?.trim() ?? "";
}

export async function saveLocalBleId(uuid: string, id: string): Promise<void> {
	const trimmedUuid = uuid.trim();
	const trimmedId = id.trim();
	if (!trimmedUuid || !trimmedId) {
		return;
	}
	const map = await readMap();
	map[trimmedUuid] = trimmedId;
	await writeMap(map);
}
