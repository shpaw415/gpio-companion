import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

const STORAGE_KEY = "gpio-companion-selected-board";

type BoardSelectionValue = {
	uuid: string;
	setUuid: (uuid: string) => void;
};

const BoardSelectionCtx = createContext<BoardSelectionValue | null>(null);

function readStoredUuid(): string {
	try {
		return window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
	} catch {
		return "";
	}
}

function writeStoredUuid(uuid: string) {
	try {
		if (uuid) {
			window.localStorage.setItem(STORAGE_KEY, uuid);
		} else {
			window.localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		return;
	}
}

export function BoardSelectionProvider({ children }: { children: ReactNode }) {
	const [uuid, setUuidState] = useState(readStoredUuid);
	const setUuid = useCallback((next: string) => {
		const trimmed = next.trim();
		setUuidState(trimmed);
		writeStoredUuid(trimmed);
	}, []);
	const value = useMemo(() => ({ uuid, setUuid }), [uuid, setUuid]);
	return (
		<BoardSelectionCtx.Provider value={value}>
			{children}
		</BoardSelectionCtx.Provider>
	);
}

export function useBoardSelection(): BoardSelectionValue {
	const ctx = useContext(BoardSelectionCtx);
	if (!ctx) {
		return { uuid: "", setUuid: () => undefined };
	}
	return ctx;
}
