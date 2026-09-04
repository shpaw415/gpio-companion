import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	type DebugEvent,
	debugProbeMessage,
	formatDiskFree,
	type MaintenanceReport,
	parseDebugEvent,
} from "gpio-companion";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ActionResult, unwrapAction } from "../lib/action.ts";
import CopyBlock from "./CopyBlock.tsx";
import DeviceSelect, { type DeviceOption } from "./DeviceSelect.tsx";

type Filter = "all" | "error" | "warning";
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
	const [uuid, setUuid] = useState(devices[0]?.uuid ?? "");
	const [connection, setConnection] = useState<Connection>("idle");
	const [error, setError] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [events, setEvents] = useState<DebugEvent[]>([]);
	const [journal, setJournal] = useState("");
	const [journalBusy, setJournalBusy] = useState(false);
	const [updateBusy, setUpdateBusy] = useState(false);
	const [updateNote, setUpdateNote] = useState("");
	const socketRef = useRef<WebSocket | null>(null);
	const logRef = useRef<HTMLPreElement | null>(null);
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
		};
	}, []);

	const visible = useMemo(() => {
		if (filter === "all") {
			return events;
		}
		return events.filter((event) => event.level === filter);
	}, [events, filter]);

	const logText = visible
		.map(
			(event) =>
				`${new Date(event.t).toISOString()} ${event.level} ${event.status} ${event.method} ${event.path} ${event.message}`,
		)
		.join("\n");

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
			setJournal(next.text.trim() || "No journal lines in the last 24 hours.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "logs failed");
		} finally {
			setJournalBusy(false);
		}
	}

	async function runUpdate() {
		if (!uuid) {
			return;
		}
		setUpdateBusy(true);
		setError("");
		setUpdateNote("");
		try {
			unwrapAction(await startUpdate(uuid));
			setUpdateNote("Update started. The board may restart.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "update failed");
		} finally {
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
					setError("debug socket failed");
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
				caught instanceof Error ? caught.message : "debug connect failed",
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
						setUuid(next);
					}}
					disabled={connection === "connecting"}
					label="Board"
				/>
				{maintenance ? (
					<Typography color="secondary" variant="body2">
						{formatDiskFree({
							totalMb: maintenance.diskTotalMb,
							availMb: maintenance.diskAvailMb,
						})}
						{maintenance.reclaimedBytes
							? ` · last cleanup reclaimed ${maintenance.reclaimedBytes} B`
							: ""}
						{maintenance.at
							? ` · ${new Date(maintenance.at).toISOString()}`
							: ""}
					</Typography>
				) : (
					<Typography color="secondary" variant="body2">
						Disk snapshot appears after the hourly cleanup runs.
					</Typography>
				)}
				<Stack direction="row" spacing={1} className="flex-wrap">
					<Button
						variant="outlined"
						disabled={!uuid || journalBusy}
						onClick={() => void fetchLogs()}
					>
						{journalBusy ? "Loading" : "Load last 24h"}
					</Button>
					<Button
						variant="outlined"
						disabled={!uuid || updateBusy}
						onClick={() => void runUpdate()}
					>
						{updateBusy ? "Starting" : "Update companion"}
					</Button>
				</Stack>
				{updateNote ? <Alert severity="success">{updateNote}</Alert> : null}
				{journal ? (
					<>
						<Paper className="p-3" elevation={0} variant="outlined">
							<pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
								{journal}
							</pre>
						</Paper>
						<CopyBlock label="Journal excerpt" value={journal} />
					</>
				) : null}
				<Stack direction="row" spacing={1} className="flex-wrap">
					<Chip
						label={connection}
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
						{connection === "live" ? "Connected" : "Connect"}
					</Button>
					<Button
						variant="outlined"
						disabled={connection === "idle"}
						onClick={disconnect}
					>
						Disconnect
					</Button>
					<Button
						variant="outlined"
						disabled={events.length === 0}
						onClick={() => setEvents([])}
					>
						Clear
					</Button>
				</Stack>
				<Stack direction="row" spacing={1} className="flex-wrap">
					{(["all", "error", "warning"] as const).map((item) => (
						<Chip
							key={item}
							label={item}
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
						{visible.length === 0 ? "No errors or warnings yet." : logText}
					</pre>
				</Paper>
				{logText ? <CopyBlock label="Debug log" value={logText} /> : null}
				<Typography color="secondary" variant="body2">
					Live errors and warnings from companion API requests. Secrets are not
					included.
				</Typography>
			</Stack>
		</Paper>
	);
}
