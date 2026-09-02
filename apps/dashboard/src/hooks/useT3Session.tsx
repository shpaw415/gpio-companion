import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { T3_DEVICE_STORAGE_KEY } from "../lib/t3-url.ts";

type T3SessionValue = {
	uuid: string;
	setUuid: (uuid: string) => void;
};

const T3SessionCtx = createContext<T3SessionValue | null>(null);

function readStoredUuid(): string {
	if (typeof window === "undefined") {
		return "";
	}
	try {
		return window.localStorage.getItem(T3_DEVICE_STORAGE_KEY)?.trim() ?? "";
	} catch {
		return "";
	}
}

function writeStoredUuid(uuid: string) {
	if (typeof window === "undefined") {
		return;
	}
	try {
		if (uuid) {
			window.localStorage.setItem(T3_DEVICE_STORAGE_KEY, uuid);
		} else {
			window.localStorage.removeItem(T3_DEVICE_STORAGE_KEY);
		}
	} catch {
		return;
	}
}

export function T3SessionProvider({ children }: { children: ReactNode }) {
	const [uuid, setUuidState] = useState(readStoredUuid);

	const setUuid = useCallback((next: string) => {
		const trimmed = next.trim();
		setUuidState(trimmed);
		writeStoredUuid(trimmed);
	}, []);

	const value = useMemo(() => ({ uuid, setUuid }), [uuid, setUuid]);

	return (
		<T3SessionCtx.Provider value={value}>{children}</T3SessionCtx.Provider>
	);
}

export function useT3Session(): T3SessionValue {
	const ctx = useContext(T3SessionCtx);
	if (!ctx) {
		return {
			uuid: "",
			setUuid: () => undefined,
		};
	}
	return ctx;
}
