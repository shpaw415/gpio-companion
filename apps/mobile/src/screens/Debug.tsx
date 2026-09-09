import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AppState,
	type AppStateStatus,
	Clipboard,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import BleHealthRunner from "../components/BleHealthRunner.tsx";
import {
	Chip,
	ErrorText,
	Muted,
	Paper,
	Screen,
	Skeleton,
	TextButton,
	Title,
} from "../components/ui.tsx";
import {
	connectDebug,
	type DebugBoard,
	debugWsUrlFromConnect,
	deviceDisplayName,
	listDebugBoards,
	loadDeviceLogs,
	startDeviceUpdate,
} from "../lib/api.ts";
import { CACHE_KEYS, useCachedQuery } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { type ReconnectSocket, startReconnectSocket } from "../lib/hub.ts";
import {
	filterJournalByAge,
	JOURNAL_WINDOWS,
	type JournalWindowId,
	journalWindowMs,
} from "../lib/journal.ts";

type LogLine = {
	t?: number;
	level?: string;
	message?: string;
	method?: string;
	path?: string;
	status?: number;
	via?: string;
};

function debugBoardOptionLabel(board: DebugBoard): string {
	const bits = [
		deviceDisplayName(board),
		board.live ? "live" : null,
		board.paired === false ? "unpaired" : null,
	].filter(Boolean);
	return bits.join(" · ");
}

function pickDebugUuid(
	boards: DebugBoard[],
	current: string,
	preferred: string,
): string {
	if (boards.some((board) => board.uuid === current)) {
		return current;
	}
	if (boards.some((board) => board.uuid === preferred)) {
		return preferred;
	}
	return boards.find((board) => board.live)?.uuid ?? boards[0]?.uuid ?? "";
}

export default function Debug() {
	const auth = useAuth();
	const colors = useColors();
	const token = auth.token;
	const { uuid: preferredUuid } = useBoardSelection();
	const loadBoards = useCallback(() => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return listDebugBoards(token);
	}, [token]);
	const query = useCachedQuery(CACHE_KEYS.debugBoards, loadBoards);
	const boards = useMemo(() => {
		const list = query.data?.devices ?? [];
		return [...list].sort(
			(left, right) => Number(Boolean(right.live)) - Number(Boolean(left.live)),
		);
	}, [query.data?.devices]);
	const [uuidState, setUuidState] = useState("");
	const uuid = pickDebugUuid(boards, uuidState, preferredUuid);
	const selected = boards.find((board) => board.uuid === uuid);
	const [lines, setLines] = useState<LogLine[]>([]);
	const [error, setError] = useState("");
	const [active, setActive] = useState("");
	const [journal, setJournal] = useState("");
	const [journalFor, setJournalFor] = useState("");
	const [journalWindow, setJournalWindow] = useState<JournalWindowId>("24h");
	const [journalBusy, setJournalBusy] = useState("");
	const [updateBusy, setUpdateBusy] = useState("");
	const [updateNote, setUpdateNote] = useState("");
	const [liveCopied, setLiveCopied] = useState(false);
	const client = useRef<ReconnectSocket | null>(null);
	const updateLock = useRef<ReturnType<typeof setTimeout> | null>(null);
	const refetch = query.refetch;

	useEffect(() => {
		void refetch({ force: true }).catch(() => undefined);
	}, [refetch]);

	useEffect(() => {
		function onAppState(state: AppStateStatus) {
			if (state === "active") {
				client.current?.resume();
				return;
			}
			client.current?.pause();
		}
		const sub = AppState.addEventListener("change", onAppState);
		return () => {
			sub.remove();
			client.current?.stop();
			if (updateLock.current) {
				clearTimeout(updateLock.current);
			}
		};
	}, []);

	const journalView = useMemo(() => {
		if (!journal) {
			return "";
		}
		return (
			filterJournalByAge(journal, journalWindowMs(journalWindow)) ||
			`No journal lines in the last ${journalWindow}.`
		);
	}, [journal, journalWindow]);

	const liveText = useMemo(
		() =>
			lines
				.map(
					(line) =>
						`${line.level ?? "log"}${line.via ? ` ${line.via}` : ""} ${line.status ?? ""} ${line.method ?? ""} ${line.path ?? ""} ${line.message ?? ""}`,
				)
				.join("\n"),
		[lines],
	);

	function resetStream() {
		client.current?.stop();
		client.current = null;
		setActive("");
		setLines([]);
		setJournal("");
		setJournalFor("");
		setUpdateNote("");
		setError("");
	}

	function pickBoard(next: string) {
		if (next === uuid) {
			return;
		}
		resetStream();
		setUuidState(next);
	}

	async function copyLive() {
		if (!liveText) {
			return;
		}
		Clipboard.setString(liveText);
		setLiveCopied(true);
		setTimeout(() => setLiveCopied(false), 1500);
	}

	async function fetchLogs(nextUuid: string) {
		if (!token) {
			return;
		}
		setError("");
		setJournalBusy(nextUuid);
		try {
			const next = await loadDeviceLogs(token, nextUuid);
			setJournalFor(nextUuid);
			setJournal(next.text.trim() || "No journal lines in the last 24 hours.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "logs failed");
		} finally {
			setJournalBusy("");
		}
	}

	async function runUpdate(nextUuid: string) {
		if (!token || updateBusy) {
			return;
		}
		if (updateLock.current) {
			clearTimeout(updateLock.current);
			updateLock.current = null;
		}
		setError("");
		setUpdateNote("");
		setUpdateBusy(nextUuid);
		try {
			await startDeviceUpdate(token, nextUuid);
			setUpdateNote("Update started. The board may restart.");
			updateLock.current = setTimeout(() => {
				setUpdateBusy("");
				updateLock.current = null;
			}, 120_000);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "update failed");
			setUpdateBusy("");
		}
	}

	function connect(nextUuid: string) {
		if (!token) {
			return;
		}
		setError("");
		client.current?.stop();
		setActive(nextUuid);
		setLines([]);
		client.current = startReconnectSocket({
			headers: { Origin: "https://gpio-companion.com" },
			open: async () =>
				debugWsUrlFromConnect(await connectDebug(token, nextUuid)),
			onMessage(data) {
				try {
					const parsed = JSON.parse(data) as LogLine;
					setLines((current) => [...current.slice(-199), parsed]);
				} catch {
					setLines((current) => [...current.slice(-199), { message: data }]);
				}
			},
			onError(message) {
				setError(message || "debug websocket failed");
			},
			onOpen() {
				setError("");
			},
		});
	}

	return (
		<Screen>
			<Title>Debug</Title>
			<Muted>
				Live companion API errors over WebSocket. Pick an online Pi to connect.
			</Muted>
			<ErrorText>{error || query.error}</ErrorText>
			{updateNote ? <Muted>{updateNote}</Muted> : null}
			<Muted>Board</Muted>
			{query.loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : boards.length === 0 ? (
				<Muted>
					Pair a board, or wait until your companion is live and websocket
					debuggable.
				</Muted>
			) : (
				<View style={{ gap: 8 }}>
					{boards.map((board) => {
						const picked = board.uuid === uuid;
						return (
							<Pressable
								key={board.uuid}
								onPress={() => pickBoard(board.uuid)}
								style={{
									backgroundColor: colors.surface,
									borderRadius: 12,
									padding: 12,
									borderWidth: 1,
									borderColor: picked ? colors.primary : colors.border,
								}}
							>
								<Text
									style={{
										color: picked ? colors.primary : colors.text,
										fontWeight: picked ? "600" : "400",
									}}
								>
									{debugBoardOptionLabel(board)}
								</Text>
							</Pressable>
						);
					})}
				</View>
			)}
			{selected ? (
				<Paper>
					<Muted>{deviceDisplayName(selected)}</Muted>
					<Muted>
						{selected.live ? "live · websocket debug" : "offline"}
						{selected.email ? ` · ${selected.email}` : ""}
						{selected.maintenance?.diskAvailMb != null &&
						selected.maintenance.diskTotalMb
							? ` · ${selected.maintenance.diskAvailMb} MB free of ${selected.maintenance.diskTotalMb} MB`
							: ""}
					</Muted>
					<TextButton
						label={active === selected.uuid ? "Reconnect" : "Connect"}
						onPress={() => void connect(selected.uuid)}
					/>
					<TextButton
						label={journalBusy === selected.uuid ? "Loading…" : "Last 24h"}
						disabled={journalBusy === selected.uuid}
						onPress={() => void fetchLogs(selected.uuid)}
					/>
					<TextButton
						label={
							updateBusy === selected.uuid ? "Updating…" : "Update companion"
						}
						disabled={Boolean(updateBusy)}
						onPress={() => void runUpdate(selected.uuid)}
					/>
					<BleHealthRunner uuid={selected.uuid} />
				</Paper>
			) : null}
			{journal ? (
				<Paper>
					<Muted>{journalFor}</Muted>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 8, flexGrow: 0 }}
						style={{ flexGrow: 0 }}
					>
						{JOURNAL_WINDOWS.map((item) => (
							<Chip
								key={item.id}
								label={item.id}
								tone={journalWindow === item.id ? "primary" : "muted"}
								filled={journalWindow === item.id}
								onPress={() => setJournalWindow(item.id)}
							/>
						))}
					</ScrollView>
					<ScrollView
						nestedScrollEnabled
						style={{ maxHeight: 320 }}
						contentContainerStyle={{ paddingBottom: 8 }}
					>
						<Text
							selectable
							style={{
								color: colors.text,
								fontFamily: "monospace",
								fontSize: 12,
							}}
						>
							{journalView}
						</Text>
					</ScrollView>
				</Paper>
			) : null}
			{lines.length > 0 ? (
				<Paper>
					<TextButton
						label={liveCopied ? "Copied" : "Copy live debug"}
						onPress={() => void copyLive()}
					/>
					<ScrollView nestedScrollEnabled style={{ maxHeight: 280 }}>
						<Text
							selectable
							style={{
								color: colors.text,
								fontFamily: "monospace",
								fontSize: 12,
							}}
						>
							{liveText}
						</Text>
					</ScrollView>
				</Paper>
			) : null}
		</Screen>
	);
}
