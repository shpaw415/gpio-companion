import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	filterJournalByAge,
	JOURNAL_WINDOWS,
	type JournalWindowId,
	journalWindowMs,
} from "../lib/journal";
import {
	connectDebug,
	deviceDisplayName,
	listDebugBoards,
	loadDeviceLogs,
	startDeviceUpdate,
} from "../api";
import { CACHE_KEYS, useCachedQuery } from "../hooks/useApiCache";
import DebugLog from "./DebugLog";
import { ListSkeleton } from "./skeletons";

type LogLine = {
	t?: number;
	level?: string;
	message?: string;
	method?: string;
	path?: string;
	status?: number;
};

export default function Debug() {
	const query = useCachedQuery(CACHE_KEYS.debugBoards, listDebugBoards);
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
	const loading = query.loading;
	const socket = useRef<WebSocket | null>(null);
	const updateLock = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			socket.current?.close();
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
		setError("");
		setJournalBusy(uuid);
		try {
			const next = await loadDeviceLogs(uuid);
			setJournalFor(uuid);
			setJournal(next.text.trim() || "No journal lines in the last 24 hours.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "logs failed");
		} finally {
			setJournalBusy("");
		}
	}

	async function runUpdate(uuid: string) {
		if (updateBusy) {
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
			await startDeviceUpdate(uuid);
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

	async function connect(uuid: string) {
		setError("");
		socket.current?.close();
		try {
			const next = await connectDebug(uuid);
			const ws = new WebSocket(next.wsUrl);
			socket.current = ws;
			setActive(uuid);
			setLines([]);
			ws.onmessage = (event) => {
				try {
					const parsed = JSON.parse(String(event.data)) as LogLine;
					setLines((current) => [...current.slice(-199), parsed]);
				} catch {
					setLines((current) => [
						...current.slice(-199),
						{ message: String(event.data) },
					]);
				}
			};
			ws.onerror = () => {
				setError("debug websocket failed");
			};
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "connect failed");
		}
	}

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Debug
			</Typography>
			{error || query.error ? (
				<Alert severity="error">{error || query.error}</Alert>
			) : null}
			{updateNote ? <Alert severity="success">{updateNote}</Alert> : null}
			{error || query.error ? <DebugLog error={error || query.error} /> : null}
			{loading ? <ListSkeleton items={3} /> : null}
			{loading
				? null
				: boards.map((board) => (
						<Paper key={board.uuid} sx={{ p: 2 }} elevation={1}>
							<Typography>{deviceDisplayName(board)}</Typography>
							<Typography color="secondary">
								{board.live ? "live" : "offline"}
								{board.email ? ` · ${board.email}` : ""}
								{board.maintenance?.diskAvailMb != null &&
								board.maintenance.diskTotalMb
									? ` · ${board.maintenance.diskAvailMb} MB free of ${board.maintenance.diskTotalMb} MB`
									: ""}
							</Typography>
							<Button variant="text" onClick={() => void connect(board.uuid)}>
								{active === board.uuid ? "Reconnect" : "Connect"}
							</Button>
							<Button
								variant="text"
								disabled={journalBusy === board.uuid}
								onClick={() => void fetchLogs(board.uuid)}
							>
								{journalBusy === board.uuid ? "Loading…" : "Last 24h"}
							</Button>
							<Button
								variant="text"
								disabled={Boolean(updateBusy)}
								onClick={() => void runUpdate(board.uuid)}
							>
								{updateBusy === board.uuid ? "Updating…" : "Update companion"}
							</Button>
						</Paper>
					))}
			{journal ? (
				<Paper sx={{ p: 2 }} elevation={1}>
					<Typography color="secondary" variant="body2">
						{journalFor}
					</Typography>
					<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", my: 1 }}>
						{JOURNAL_WINDOWS.map((item) => (
							<Chip
								key={item.id}
								label={item.id}
								color={journalWindow === item.id ? "primary" : "secondary"}
								variant={journalWindow === item.id ? "filled" : "outlined"}
								onClick={() => setJournalWindow(item.id)}
							/>
						))}
					</Stack>
					<Paper
						sx={{ maxHeight: 320, overflow: "auto", p: 1.5 }}
						elevation={0}
						variant="outlined"
					>
						<Typography
							Element="pre"
							sx={{
								m: 0,
								whiteSpace: "pre-wrap",
								fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
								fontSize: 12,
							}}
						>
							{journalView}
						</Typography>
					</Paper>
				</Paper>
			) : null}
			{lines.length > 0 ? (
				<Typography
					Element="pre"
					sx={{
						m: 0,
						maxHeight: 360,
						overflow: "auto",
						whiteSpace: "pre-wrap",
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						fontSize: 12,
					}}
				>
					{lines
						.map(
							(line) =>
								`${line.level ?? "log"} ${line.method ?? ""} ${line.path ?? ""} ${line.message ?? ""}`,
						)
						.join("\n")}
				</Typography>
			) : null}
		</Stack>
	);
}
