import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useState } from "react";
import { bleRun, loadRun, type RunStatus, startRun, stopRun } from "../api";
import { useSavedBleId } from "../hooks/useApiCache";
import { useDeviceHub } from "../hooks/useDeviceHub";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";

export default function RunPanel({ uuid }: { uuid: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<RunStatus | null>(null);
	const [dir, setDir] = useState("");
	const offline = useOfflineBleKey(uuid);
	const bleId = useSavedBleId(uuid);
	const onRun = useCallback((next: RunStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, { onRun });

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	const log = status?.log || status?.last?.log || "";

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">Run on board</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			<TextField
				label="Sketch dir on the Pi"
				value={dir}
				onChange={(event) => setDir(event.target.value)}
			/>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="contained"
					size="small"
					disabled={busy || !dir.trim()}
					onClick={() => {
						start(async () => {
							await startRun({ uuid, dir: dir.trim() });
							setStatus(await loadRun(uuid));
						});
					}}
				>
					Start
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy}
					onClick={() => {
						start(async () => {
							await stopRun(uuid);
							setStatus(await loadRun(uuid));
						});
					}}
				>
					Stop
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !dir.trim()}
					onClick={() => {
						start(async () => {
							await bleRun({ uuid, id: bleId, dir: dir.trim() });
						});
					}}
				>
					Start over Bluetooth
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy}
					onClick={() => {
						start(async () => {
							await bleRun({ uuid, id: bleId, stop: true });
						});
					}}
				>
					Stop over Bluetooth
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			<Typography color="secondary" variant="body2">
				{status?.running
					? "Running on companion GPIO…"
					: status?.last
						? status.last.ok
							? "Last run exited 0"
							: "Last run failed"
						: "C sketch on the Pi, then run on this header."}
			</Typography>
			{log ? (
				<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
					{log}
				</Typography>
			) : null}
		</Stack>
	);
}
