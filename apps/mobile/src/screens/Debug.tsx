import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus, ScrollView, Text } from "react-native";
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
	deviceDisplayName,
	listDebugBoards,
	loadDeviceLogs,
	startDeviceUpdate,
} from "../lib/api.ts";
import { CACHE_KEYS, useCachedQuery } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { startReconnectSocket, type ReconnectSocket } from "../lib/hub.ts";
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
};

export default function Debug() {
	const auth = useAuth();
	const colors = useColors();
	const token = auth.token;
	const query = useCachedQuery(CACHE_KEYS.debugBoards, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return listDebugBoards(token);
	});
	const boards = query.data?.devices ?? [];
	const [lines, setLines] = useState<LogLine[]>([]);
	const [error, setError] = useState("");
	const [active, setActive] = useState("");
	const [journal, setJournal] = useState("");
	const [journalFor, setJournalFor] = useState("");
	const [journalWindow, setJournalWindow] = useState<JournalWindowId>("24h");
	const [journalBusy, setJournalBusy] = useState("");
	const [updateBusy, setUpdateBusy] = useState("");
	const [updateNote, setUpdateNote] = useState("");
	const client = useRef<ReconnectSocket | null>(null);
	const updateLock = useRef<ReturnType<typeof setTimeout> | null>(null);

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

	async function fetchLogs(uuid: string) {
		if (!token) {
			return;
		}
		setError("");
		setJournalBusy(uuid);
		try {
			const next = await loadDeviceLogs(token, uuid);
			setJournalFor(uuid);
			setJournal(next.text.trim() || "No journal lines in the last 24 hours.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "logs failed");
		} finally {
			setJournalBusy("");
		}
	}

	async function runUpdate(uuid: string) {
		if (!token || updateBusy) {
			return;
		}
		if (updateLock.current) {
			clearTimeout(updateLock.current);
			updateLock.current = null;
		}
		setError("");
		setUpdateNote("");
		setUpdateBusy(uuid);
		try {
			await startDeviceUpdate(token, uuid);
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

	function connect(uuid: string) {
		if (!token) {
			return;
		}
		setError("");
		client.current?.stop();
		setActive(uuid);
		setLines([]);
		client.current = startReconnectSocket({
			open: async () => {
				const next = await connectDebug(token, uuid);
				const wsUrl = next.wsUrl?.trim() ?? "";
				if (!wsUrl) {
					throw new Error("missing websocket url");
				}
				return wsUrl;
			},
			onMessage(data) {
				try {
					const parsed = JSON.parse(data) as LogLine;
					setLines((current) => [...current.slice(-199), parsed]);
				} catch {
					setLines((current) => [
						...current.slice(-199),
						{ message: data },
					]);
				}
			},
			onError() {
				setError("debug websocket failed");
			},
			onOpen() {
				setError("");
			},
		});
	}

	return (
		<Screen>
			<Title>Debug</Title>
			<ErrorText>{error || query.error}</ErrorText>
			{updateNote ? <Muted>{updateNote}</Muted> : null}
			{query.loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : (
				boards.map((board) => (
					<Paper key={board.uuid}>
						<Muted>{deviceDisplayName(board)}</Muted>
						<Muted>
							{board.live ? "live" : "offline"}
							{board.email ? ` · ${board.email}` : ""}
							{board.maintenance?.diskAvailMb != null &&
							board.maintenance.diskTotalMb
								? ` · ${board.maintenance.diskAvailMb} MB free of ${board.maintenance.diskTotalMb} MB`
								: ""}
						</Muted>
						<TextButton
							label={active === board.uuid ? "Reconnect" : "Connect"}
							onPress={() => void connect(board.uuid)}
						/>
						<TextButton
							label={journalBusy === board.uuid ? "Loading…" : "Last 24h"}
							disabled={journalBusy === board.uuid}
							onPress={() => void fetchLogs(board.uuid)}
						/>
						<TextButton
							label={
								updateBusy === board.uuid ? "Updating…" : "Update companion"
							}
							disabled={Boolean(updateBusy)}
							onPress={() => void runUpdate(board.uuid)}
						/>
						<BleHealthRunner uuid={board.uuid} />
					</Paper>
				))
			)}
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
					<ScrollView nestedScrollEnabled style={{ maxHeight: 280 }}>
						<Text
							selectable
							style={{
								color: colors.text,
								fontFamily: "monospace",
								fontSize: 12,
							}}
						>
							{lines
								.map(
									(line) =>
										`${line.level ?? "log"} ${line.method ?? ""} ${line.path ?? ""} ${line.message ?? ""}`,
								)
								.join("\n")}
						</Text>
					</ScrollView>
				</Paper>
			) : null}
		</Screen>
	);
}
