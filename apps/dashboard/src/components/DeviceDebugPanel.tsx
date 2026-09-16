import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	type DebugEvent,
	debugProbeMessage,
	filterJournalByAge,
	formatDebugLogLine,
	JOURNAL_WINDOWS,
	type JournalWindowId,
	journalWindowMs,
	type MaintenanceReport,
	parseDebugEvent,
} from "gpio-companion";
import { translateError } from "gpio-companion/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../hooks/useLocale.tsx";
import { type ActionResult, unwrapAction } from "../lib/action.ts";
import BleHealthRunner from "./BleHealthRunner.tsx";
import CopyBlock from "./CopyBlock.tsx";
import DeviceSelect, { type DeviceOption } from "./DeviceSelect.tsx";

type Filter = "all" | "error" | "warning" | "info";
type Connection = "idle" | "connecting" | "live" | "error";

export type DebugPanelDevice = DeviceOption & {
	maintenance?: MaintenanceReport | null;
};

export default function DeviceDebugPanel({
	devices,
	signConnect,
	loadLogs,
	startUpdate,
}: {
	devices: DebugPanelDevice[];
	signConnect: (uuid: string) => Promise<
		ActionResult<{
			wsUrl: string;
			probe: { status: number; error: string; ready: boolean };
		}>
	>;
	loadLogs: (uuid: string) => Promise<ActionResult<{ text: string }>>;
	startUpdate: (uuid: string) => Promise<ActionResult<{ started: boolean }>>;
}) {
	const t = useT();
	const [uuid, setUuid] = useState(devices[0]?.uuid ?? "");
	const [connection, setConnection] = useState<Connection>("idle");
	const [error, setError] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [events, setEvents] = useState<DebugEvent[]>([]);
	const [journal, setJournal] = useState("");
	const [journalWindow, setJournalWindow] = useState<JournalWindowId>("24h");
	const [journalBusy, setJournalBusy] = useState(false);
	const [updateBusy, setUpdateBusy] = useState(false);
	const [updateNote, setUpdateNote] = useState("");
	const [liveCopied, setLiveCopied] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	const logRef = useRef<HTMLPreElement | null>(null);
	const journalRef = useRef<HTMLPreElement | null>(null);
	const updateLockRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const selected = devices.find((device) => device.uuid === uuid);
	const maintenance = selected?.maintenance ?? null;

	useEffect(() => {
		if (!uuid && devices[0]) {
			setUuid(devices[0].uuid);
		}
	}, [devices, uuid]);

	useEffect(() => {
		return () => {
			socketRef.current?.close();
			socketRef.current = null;
			if (updateLockRef.current) {
				clearTimeout(updateLockRef.current);
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

	const visible = useMemo(() => {
		if (filter === "all") {
			return events;
		}
		return events.filter((event) => event.level === filter);
	}, [events, filter]);

	const logText = visible.map(formatDebugLogLine).join("\n");

	async function copyLive() {
		if (!logText) {
			return;
		}
		await navigator.clipboard.writeText(logText).catch(() => undefined);
		setLiveCopied(true);
		window.setTimeout(() => setLiveCopied(false), 1500);
	}

	function scrollLog() {
		logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
	}

	function disconnect() {
		socketRef.current?.close();
		socketRef.current = null;
		setConnection("idle");
	}

	async function fetchLogs() {
		if (!uuid) {
			return;
		}
		setJournalBusy(true);
		setError("");
		try {
			const next = unwrapAction(await loadLogs(uuid));
			setJournal(next.text.trim() || t("debug.noJournal24h"));
		} catch (caught) {
			setError(
				translateError(
					t,
					caught instanceof Error ? caught.message : "logs failed",
				),
			);
		} finally {
			setJournalBusy(false);
		}
	}

	async function runUpdate() {
		if (!uuid || updateBusy) {
			return;
		}
		if (updateLockRef.current) {
			clearTimeout(updateLockRef.current);
			updateLockRef.current = null;
		}
		setUpdateBusy(true);
		setError("");
		setUpdateNote("");
		try {
			unwrapAction(await startUpdate(uuid));
			setUpdateNote(t("debug.updateStarted"));
			updateLockRef.current = setTimeout(() => {
				setUpdateBusy(false);
				updateLockRef.current = null;
			}, 120_000);
		} catch (caught) {
			setError(
				translateError(
					t,
					caught instanceof Error ? caught.message : "update failed",
				),
			);
			setUpdateBusy(false);
		}
	}

	async function connect() {
		if (!uuid) {
			return;
		}
		disconnect();
		setError("");
		setConnection("connecting");
		try {
			const signed = unwrapAction(await signConnect(uuid));
			if (!signed.probe.ready) {
				setConnection("error");
				setError(debugProbeMessage(signed.probe));
				return;
			}
			const socket = new WebSocket(signed.wsUrl);
			socketRef.current = socket;
			socket.addEventListener("open", () => {
				if (socketRef.current === socket) {
					setConnection("live");
				}
			});
			socket.addEventListener("message", (event) => {
				if (socketRef.current !== socket) {
					return;
				}
				try {
					const parsed = parseDebugEvent(JSON.parse(String(event.data)));
					if (parsed) {
						setEvents((current) => [...current, parsed]);
						requestAnimationFrame(scrollLog);
					}
				} catch {
					// ignore non-event frames
				}
			});
			socket.addEventListener("error", () => {
				if (socketRef.current === socket) {
					setConnection("error");
					setError(t("errors.debugWsFailed"));
				}
			});
			socket.addEventListener("close", () => {
				if (socketRef.current === socket) {
					socketRef.current = null;
					setConnection((current) =>
						current === "connecting" ? "error" : "idle",
					);
				}
			});
		} catch (caught) {
			setConnection("error");
			setError(
				translateError(
					t,
					caught instanceof Error ? caught.message : "debug connect failed",
				),
			);
		}
	}

	return (
		<Paper className="w-full max-w-3xl p-4 min-[900px]:p-6" elevation={1}>
			<Stack spacing={2}>
				<DeviceSelect
					devices={devices}
					value={uuid}
					onChange={(next) => {
						disconnect();
						setJournal("");
						setUpdateNote("");
						if (updateLockRef.current) {
							clearTimeout(updateLockRef.current);
							updateLockRef.current = null;
						}
						setUpdateBusy(false);
						setUuid(next);
					}}
					disabled={connection === "connecting"}
					label={t("docs.board")}
				/>
				{maintenance ? (
					<Typography color="secondary" variant="body2">
						{t("debug.diskFree", {
							n: maintenance.diskAvailMb,
							pct: Math.max(
								0,
								Math.min(
									100,
									Math.round(
										(maintenance.diskAvailMb / maintenance.diskTotalMb) * 100,
									),
								),
							),
						})}
						{maintenance.reclaimedBytes
							? t("debug.reclaimed", { n: maintenance.reclaimedBytes })
							: ""}
						{maintenance.at
							? ` · ${new Date(maintenance.at).toISOString()}`
							: ""}
					</Typography>
				) : (
					<Typography color="secondary" variant="body2">
						{t("debug.diskSnapshot")}
					</Typography>
				)}
				<Stack direction="row" spacing={1} className="flex-wrap">
					<Button
						variant="outlined"
						disabled={!uuid || journalBusy}
						onClick={() => void fetchLogs()}
					>
						{journalBusy ? t("debug.loading") : t("debug.last24h")}
					</Button>
					<Button
						variant="outlined"
						disabled={!uuid || updateBusy}
						onClick={() => void runUpdate()}
					>
						{updateBusy ? t("debug.updating") : t("debug.updateCompanion")}
					</Button>
				</Stack>
				{updateNote ? <Alert severity="success">{updateNote}</Alert> : null}
				{journal ? (
					<>
						<Stack direction="row" spacing={1} className="flex-wrap">
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
							className="p-3"
							elevation={0}
							variant="outlined"
							sx={{ maxHeight: 320, overflow: "auto" }}
						>
							<pre
								ref={journalRef}
								className="m-0 whitespace-pre-wrap break-all font-mono text-xs"
							>
								{journalView}
							</pre>
						</Paper>
						<CopyBlock label={t("debug.journalExcerpt")} value={journalView} />
					</>
				) : null}
				<Stack direction="row" spacing={1} className="flex-wrap">
					<Chip
						label={
							connection === "live"
								? t("gpio.liveChip")
								: connection === "connecting"
									? t("gpio.connecting")
									: connection === "error"
										? t("debug.filterError")
										: t("debug.idle")
						}
						color={
							connection === "live"
								? "success"
								: connection === "error"
									? "error"
									: "secondary"
						}
						variant="outlined"
					/>
					<Button
						variant="contained"
						disabled={
							!uuid || connection === "connecting" || connection === "live"
						}
						onClick={() => void connect()}
					>
						{connection === "live" ? t("debug.connected") : t("debug.connect")}
					</Button>
					<Button
						variant="outlined"
						disabled={connection === "idle"}
						onClick={disconnect}
					>
						{t("debug.disconnect")}
					</Button>
					<Button
						variant="outlined"
						disabled={events.length === 0}
						onClick={() => setEvents([])}
					>
						{t("debug.clear")}
					</Button>
					<Button
						variant="outlined"
						disabled={!logText}
						onClick={() => void copyLive()}
					>
						{liveCopied ? t("common.copied") : t("debug.copyLive")}
					</Button>
				</Stack>
				<Stack direction="row" spacing={1} className="flex-wrap">
					{(["all", "error", "warning", "info"] as const).map((item) => (
						<Chip
							key={item}
							label={
								item === "all"
									? t("debug.filterAll")
									: item === "error"
										? t("debug.filterError")
										: item === "warning"
											? t("debug.filterWarning")
											: t("debug.filterInfo")
							}
							color={filter === item ? "primary" : "secondary"}
							variant={filter === item ? "filled" : "outlined"}
							onClick={() => setFilter(item)}
						/>
					))}
				</Stack>
				{error ? <Alert severity="error">{error}</Alert> : null}
				<Paper className="p-3" elevation={0} variant="outlined">
					<pre
						ref={logRef}
						className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs"
					>
						{visible.length === 0 ? t("debug.noEvents") : logText}
					</pre>
				</Paper>
				<Typography color="secondary" variant="body2">
					{t("debug.liveHint")}
				</Typography>
				<BleHealthRunner uuid={uuid} />
			</Stack>
		</Paper>
	);
}
