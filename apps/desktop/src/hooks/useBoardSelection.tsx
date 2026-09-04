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
	pairToken: string;
	openT3Pair: (uuid: string, token: string) => void;
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

export function BoardSelectionProvider({
	children,
	onOpenT3,
}: {
	children: ReactNode;
	onOpenT3?: () => void;
}) {
	const [uuid, setUuidState] = useState(readStoredUuid);
	const [pairToken, setPairToken] = useState("");

	const setUuid = useCallback((next: string) => {
		const trimmed = next.trim();
		setUuidState((current) => {
			if (current !== trimmed) {
				setPairToken("");
			}
			return trimmed;
		});
		writeStoredUuid(trimmed);
	}, []);

	const openT3Pair = useCallback(
		(nextUuid: string, token: string) => {
			const trimmed = nextUuid.trim();
			const pair = token.trim();
			setUuidState(trimmed);
			writeStoredUuid(trimmed);
			setPairToken(pair);
			onOpenT3?.();
		},
		[onOpenT3],
	);

	const value = useMemo(
		() => ({ uuid, setUuid, pairToken, openT3Pair }),
		[uuid, setUuid, pairToken, openT3Pair],
	);
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
			pairToken: "",
			openT3Pair: () => undefined,
		};
	}
	return ctx;
}
