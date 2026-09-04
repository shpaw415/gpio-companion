const memory = new Map<string, string>();

type Store = {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
	removeItem(key: string): Promise<void>;
};

let native: Store | null | undefined;

async function store(): Promise<Store> {
	if (native !== undefined) {
		return native ?? memoryStore();
	}
	try {
		const mod = await import("@react-native-async-storage/async-storage");
		native = mod.default;
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
		removeItem: async (key) => {
			memory.delete(key);
		},
	};
}

export async function storageGet(key: string): Promise<string | null> {
	return (await store()).getItem(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
	await (await store()).setItem(key, value);
}

export async function storageRemove(key: string): Promise<void> {
	await (await store()).removeItem(key);
}
