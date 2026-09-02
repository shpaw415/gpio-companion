import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { type DebugEvent, parseDebugEvent } from "gpio-companion";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ActionResult, unwrapAction } from "../lib/action.ts";
import CopyBlock from "./CopyBlock.tsx";
import DeviceSelect, { type DeviceOption } from "./DeviceSelect.tsx";

type Filter = "all" | "error" | "warning";
type Connection = "idle" | "connecting" | "live" | "error";

export default function DeviceDebugPanel({
	devices,
	signConnect,
}: {
	devices: DeviceOption[];
	signConnect: (uuid: string) => Promise<
		ActionResult<{
			wsUrl: string;
			probe: { status: number; error: string; ready: boolean };
		}>
	>;
}) {
	const [uuid, setUuid] = useState(devices[0]?.uuid ?? "");
	const [connection, setConnection] = useState<Connection>("idle");
	const [error, setError] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [events, setEvents] = useState<DebugEvent[]>([]);
	const socketRef = useRef<WebSocket | null>(null);
	const logRef = useRef<HTMLPreElement | null>(null);

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
				setError(
					signed.probe.status
						? `${signed.probe.status} ${signed.probe.error}`
						: signed.probe.error,
				);
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
		<Paper className="max-w-3xl p-6" elevation={1}>
			<Stack spacing={2}>
				<DeviceSelect
					devices={devices}
					value={uuid}
					onChange={(next) => {
						disconnect();
						setUuid(next);
					}}
					disabled={connection === "connecting"}
					label="Board"
				/>
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
						disabled={!uuid || connection === "connecting"}
						onClick={() => void connect()}
					>
						Connect
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
