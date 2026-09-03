import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

export const BOARD_SELECTION_STORAGE_KEY = "gpio-companion-selected-board";
export const LEGACY_BOARD_SELECTION_STORAGE_KEY = "gpio-companion-t3-device";

type BoardSelectionValue = {
	uuid: string;
	setUuid: (uuid: string) => void;
};

const BoardSelectionCtx = createContext<BoardSelectionValue | null>(null);

function readStoredUuid(): string {
	if (typeof window === "undefined") {
		return "";
	}
	try {
		const stored =
			window.localStorage.getItem(BOARD_SELECTION_STORAGE_KEY)?.trim() ?? "";
		if (stored) {
			return stored;
		}
		return (
			window.localStorage.getItem(LEGACY_BOARD_SELECTION_STORAGE_KEY)?.trim() ??
			""
		);
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
			window.localStorage.setItem(BOARD_SELECTION_STORAGE_KEY, uuid);
		} else {
			window.localStorage.removeItem(BOARD_SELECTION_STORAGE_KEY);
		}
		window.localStorage.removeItem(LEGACY_BOARD_SELECTION_STORAGE_KEY);
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
		return {
			uuid: "",
			setUuid: () => undefined,
		};
	}
	return ctx;
}
