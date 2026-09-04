import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import {
	connectDebug,
	type DebugBoard,
	deviceDisplayName,
	listDebugBoards,
} from "../api";
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
	const [boards, setBoards] = useState<DebugBoard[]>([]);
	const [lines, setLines] = useState<LogLine[]>([]);
	const [error, setError] = useState("");
	const [active, setActive] = useState("");
	const [loading, setLoading] = useState(true);
	const socket = useRef<WebSocket | null>(null);

	useEffect(() => {
		let cancelled = false;
		void listDebugBoards()
			.then((result) => {
				if (!cancelled) {
					setBoards(result.devices);
				}
			})
			.catch((caught) => {
				if (!cancelled) {
					setError(caught instanceof Error ? caught.message : "load failed");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
			socket.current?.close();
		};
	}, []);

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
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
			{loading ? <ListSkeleton items={3} /> : null}
			{loading
				? null
				: boards.map((board) => (
				<Paper key={board.uuid} sx={{ p: 2 }} elevation={1}>
					<Typography>{deviceDisplayName(board)}</Typography>
					<Typography color="secondary">
						{board.live ? "live" : "offline"}
						{board.email ? ` · ${board.email}` : ""}
					</Typography>
					<Button
						variant="text"
						onClick={() => void connect(board.uuid)}
					>
						{active === board.uuid ? "Reconnect" : "Connect"}
					</Button>
				</Paper>
			))}
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
