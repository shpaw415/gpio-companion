import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { storageGet, storageRemove, storageSet } from "./storage.ts";

const STORAGE_KEY = "gpio-companion-selected-board";
const LEGACY_STORAGE_KEY = "gpio-companion-t3-device";

type BoardSelectionValue = {
	uuid: string;
	setUuid: (uuid: string) => void;
	pairToken: string;
	openT3Pair: (uuid: string, token: string) => void;
	clearPairToken: () => void;
};

const BoardSelectionCtx = createContext<BoardSelectionValue | null>(null);

export function BoardSelectionProvider({
	children,
	onOpenT3,
}: {
	children: ReactNode;
	onOpenT3?: () => void;
}) {
	const [uuid, setUuidState] = useState("");
	const [pairToken, setPairToken] = useState("");

	useEffect(() => {
		void Promise.all([
			storageGet(STORAGE_KEY),
			storageGet(LEGACY_STORAGE_KEY),
		]).then(([stored, legacy]) => {
			const selected = stored?.trim() || legacy?.trim() || "";
			if (selected) setUuidState(selected);
		});
	}, []);

	const setUuid = useCallback((next: string) => {
		const trimmed = next.trim();
		setUuidState((current) => {
			if (current !== trimmed) {
				setPairToken("");
			}
			return trimmed;
		});
		if (trimmed) {
			void storageSet(STORAGE_KEY, trimmed);
			void storageRemove(LEGACY_STORAGE_KEY);
		} else {
			void storageRemove(STORAGE_KEY);
		}
	}, []);

	const openT3Pair = useCallback(
		(nextUuid: string, token: string) => {
			const trimmed = nextUuid.trim();
			setUuidState(trimmed);
			if (trimmed) {
				void storageSet(STORAGE_KEY, trimmed);
				void storageRemove(LEGACY_STORAGE_KEY);
			}
			setPairToken(token.trim());
			onOpenT3?.();
		},
		[onOpenT3],
	);

	const clearPairToken = useCallback(() => {
		setPairToken("");
	}, []);

	const value = useMemo(
		() => ({ uuid, setUuid, pairToken, openT3Pair, clearPairToken }),
		[uuid, setUuid, pairToken, openT3Pair, clearPairToken],
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
			clearPairToken: () => undefined,
		};
	}
	return ctx;
}
