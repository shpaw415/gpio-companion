import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	type BoardSketch,
	bleRun,
	loadRun,
	loadRunSketches,
	type RunStatus,
	startRun,
	stopRun,
} from "../api";
import { useSavedBleId } from "../hooks/useApiCache";
import { useDeviceHub } from "../hooks/useDeviceHub";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";

export default function RunPanel({
	uuid,
	project,
}: {
	uuid: string;
	project?: string;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<RunStatus | null>(null);
	const [dir, setDir] = useState("");
	const [sketches, setSketches] = useState<BoardSketch[]>([]);
	const [legacy, setLegacy] = useState(false);
	const offline = useOfflineBleKey(uuid);
	const bleId = useSavedBleId(uuid);
	const listed = useMemo(
		() => sketches.filter((item) => !project || item.project === project),
		[sketches, project],
	);
	const onRun = useCallback((next: RunStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, { onRun });

	useEffect(() => {
		if (!uuid) {
			setSketches([]);
			setLegacy(false);
			return;
		}
		let cancelled = false;
		loadRunSketches(uuid)
			.then((result) => {
				if (cancelled) {
					return;
				}
				setSketches(result.sketches);
				setLegacy(false);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setSketches([]);
				setLegacy(true);
			});
		return () => {
			cancelled = true;
		};
	}, [uuid]);

	useEffect(() => {
		if (legacy) {
			return;
		}
		if (!listed.some((item) => item.dir === dir)) {
			setDir(listed[0]?.dir ?? "");
		}
	}, [listed, dir, legacy]);

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
	const canStart = Boolean(dir.trim()) && (legacy || Boolean(project));

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">Run on board</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			{legacy ? (
				<TextField
					label="Sketch dir on the Pi"
					value={dir}
					onChange={(event) => setDir(event.target.value)}
				/>
			) : !project ? (
				<Typography color="secondary" variant="body2">
					Select a project to see host sketches on this board.
				</Typography>
			) : listed.length === 0 ? (
				<Typography color="secondary" variant="body2">
					No host sketches on this board for this project. Ask Code to write
					them under host/.
				</Typography>
			) : (
				<Select name="host-sketch" label="Sketch" value={dir} onSelect={setDir}>
					{listed.map((item) => (
						<option key={item.dir} value={item.dir}>
							{item.name}
						</option>
					))}
				</Select>
			)}
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="contained"
					size="small"
					disabled={busy || !canStart}
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
					disabled={busy || !canStart}
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
