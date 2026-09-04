import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
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
import {
	ErrorText,
	Muted,
	Paper,
	Screen,
	Skeleton,
	TextButton,
	Title,
} from "../components/ui.tsx";

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
	const [updateNote, setUpdateNote] = useState("");
	const socket = useRef<WebSocket | null>(null);

	useEffect(() => {
		return () => {
			socket.current?.close();
		};
	}, []);

	async function fetchLogs(uuid: string) {
		if (!token) {
			return;
		}
		setError("");
		try {
			const next = await loadDeviceLogs(token, uuid);
			setJournalFor(uuid);
			setJournal(next.text.trim() || "No journal lines in the last 24 hours.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "logs failed");
		}
	}

	async function runUpdate(uuid: string) {
		if (!token) {
			return;
		}
		setError("");
		setUpdateNote("");
		try {
			await startDeviceUpdate(token, uuid);
			setUpdateNote("Update started. The board may restart.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "update failed");
		}
	}

	async function connect(uuid: string) {
		if (!token) {
			return;
		}
		setError("");
		socket.current?.close();
		try {
			const next = await connectDebug(token, uuid);
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
							{board.maintenance?.diskAvailMb != null && board.maintenance.diskTotalMb
								? ` · ${board.maintenance.diskAvailMb} MB free of ${board.maintenance.diskTotalMb} MB`
								: ""}
						</Muted>
						<TextButton
							label={active === board.uuid ? "Reconnect" : "Connect"}
							onPress={() => void connect(board.uuid)}
						/>
						<TextButton label="Last 24h" onPress={() => void fetchLogs(board.uuid)} />
						<TextButton label="Update companion" onPress={() => void runUpdate(board.uuid)} />
					</Paper>
				))
			)}
			{journal ? (
				<Text
					selectable
					style={{ color: colors.text, fontFamily: "monospace", fontSize: 12 }}
				>
					{journalFor ? `${journalFor}\n` : ""}
					{journal}
				</Text>
			) : null}
			{lines.length > 0 ? (
				<Text
					selectable
					style={{ color: colors.text, fontFamily: "monospace", fontSize: 12 }}
				>
					{lines
						.map(
							(line) =>
								`${line.level ?? "log"} ${line.method ?? ""} ${line.path ?? ""} ${line.message ?? ""}`,
						)
						.join("\n")}
				</Text>
			) : null}
		</Screen>
	);
}
