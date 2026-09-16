import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { translateError } from "gpio-companion-i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	connectDebug,
	type DebugBoard,
	debugWsUrlFromConnect,
	deviceDisplayName,
	listDebugBoards,
	loadDeviceLogs,
	startDeviceUpdate,
} from "../api";
import { CACHE_KEYS, useCachedQuery } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { type ReconnectSocket, startReconnectSocket } from "../hub";
import {
	filterJournalByAge,
	JOURNAL_WINDOWS,
	type JournalWindowId,
	journalWindowMs,
} from "../lib/journal";
import { useT } from "../locale";
import BleHealthRunner from "./BleHealthRunner";
import DebugLog from "./DebugLog";
import { SelectSkeleton } from "./skeletons";

type LogLine = {
	t?: number;
	level?: string;
	message?: string;
	method?: string;
	path?: string;
	status?: number;
	via?: string;
};

function debugBoardOptionLabel(
	board: DebugBoard,
	live: string,
	unpaired: string,
): string {
	const bits = [
		board.label?.trim() || null,
		board.live ? live : null,
		board.paired === false ? unpaired : null,
		board.email || board.login || null,
	].filter(Boolean);
	const prefix = bits.join(" · ");
	return prefix ? `${prefix} — ${board.uuid}` : board.uuid;
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
	const t = useT();
	const query = useCachedQuery(CACHE_KEYS.debugBoards, listDebugBoards);
	const { uuid: preferredUuid } = useBoardSelection();
	const [uuidState, setUuidState] = useState("");
	const boards = useMemo(() => {
		const list = query.data?.devices ?? [];
		return [...list].sort(
			(left, right) => Number(Boolean(right.live)) - Number(Boolean(left.live)),
		);
	}, [query.data?.devices]);
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
	const loading = query.loading;
	const client = useRef<ReconnectSocket | null>(null);
	const updateLock = useRef<ReturnType<typeof setTimeout> | null>(null);
	const refetch = query.refetch;
	const shown = translateError(t, error || query.error);

	useEffect(() => {
		void refetch({ force: true }).catch(() => undefined);
	}, [refetch]);

	useEffect(() => {
		return () => {
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
			t("debug.noJournalWindow", { window: journalWindow })
		);
	}, [journal, journalWindow, t]);

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
		await navigator.clipboard.writeText(liveText).catch(() => undefined);
		setLiveCopied(true);
		window.setTimeout(() => setLiveCopied(false), 1500);
	}

	async function fetchLogs(nextUuid: string) {
		setError("");
		setJournalBusy(nextUuid);
		try {
			const next = await loadDeviceLogs(nextUuid);
			setJournalFor(nextUuid);
			setJournal(next.text.trim() || t("debug.noJournal24h"));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "logs failed");
		} finally {
			setJournalBusy("");
		}
	}

	async function runUpdate(nextUuid: string) {
		if (updateBusy) {
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
			await startDeviceUpdate(nextUuid);
			setUpdateNote(t("debug.updateStarted"));
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
		setError("");
		client.current?.stop();
		setActive(nextUuid);
		setLines([]);
		client.current = startReconnectSocket({
			open: async () => debugWsUrlFromConnect(await connectDebug(nextUuid)),
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
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				{t("debug.title")}
			</Typography>
			<Typography color="secondary">{t("debug.nativeHint")}</Typography>
			{shown ? <Alert severity="error">{shown}</Alert> : null}
			{updateNote ? <Alert severity="success">{updateNote}</Alert> : null}
			{shown ? <DebugLog error={shown} /> : null}
			{loading ? <SelectSkeleton height={56} width="100%" /> : null}
			{loading ? null : boards.length === 0 ? (
				<Alert severity="info">{t("debug.noLiveNative")}</Alert>
			) : (
				<Select
					name="board"
					label={t("docs.board")}
					value={uuid}
					onSelect={pickBoard}
					sx={{ width: "100%" }}
					disabled={boards.length === 0}
				>
					{boards.map((board) => (
						<option key={board.uuid} value={board.uuid}>
							{debugBoardOptionLabel(
								board,
								t("debug.live"),
								t("debug.unpaired"),
							)}
						</option>
					))}
				</Select>
			)}
			{selected ? (
				<Paper sx={{ p: 2 }} elevation={1}>
					<Typography>{deviceDisplayName(selected)}</Typography>
					<Typography color="secondary">
						{selected.live ? t("debug.liveWs") : t("debug.offline")}
						{selected.email ? ` · ${selected.email}` : ""}
						{selected.maintenance?.diskAvailMb != null &&
						selected.maintenance.diskTotalMb
							? t("debug.mbFreeOf", {
									avail: selected.maintenance.diskAvailMb,
									total: selected.maintenance.diskTotalMb,
								})
							: ""}
					</Typography>
					<Button variant="text" onClick={() => void connect(selected.uuid)}>
						{active === selected.uuid
							? t("debug.reconnect")
							: t("debug.connect")}
					</Button>
					<Button
						variant="text"
						disabled={journalBusy === selected.uuid}
						onClick={() => void fetchLogs(selected.uuid)}
					>
						{journalBusy === selected.uuid
							? t("debug.loading")
							: t("debug.last24h")}
					</Button>
					<Button
						variant="text"
						disabled={Boolean(updateBusy)}
						onClick={() => void runUpdate(selected.uuid)}
					>
						{updateBusy === selected.uuid
							? t("debug.updating")
							: t("debug.updateCompanion")}
					</Button>
					<BleHealthRunner uuid={selected.uuid} />
				</Paper>
			) : null}
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
				<Stack spacing={1}>
					<Button variant="outlined" onClick={() => void copyLive()}>
						{liveCopied ? t("common.copied") : t("debug.copyLive")}
					</Button>
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
						{liveText}
					</Typography>
				</Stack>
			) : null}
		</Stack>
	);
}
