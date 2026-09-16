import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { translateError } from "gpio-companion-i18n";
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
import { useConsoleTunnel } from "../hooks/useConsoleTunnel";
import { useDeviceHub } from "../hooks/useDeviceHub";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";
import { consoleStatusLabel } from "../lib/i18n-labels";
import { useT } from "../locale";

export default function RunPanel({
	uuid,
	project,
}: {
	uuid: string;
	project?: string;
}) {
	const t = useT();
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
	const serial = useConsoleTunnel(uuid, setError);

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

	const log =
		serial.snapshot.host.log || status?.log || status?.last?.log || "";
	const canStart = Boolean(dir.trim()) && (legacy || Boolean(project));

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">{t("run.title")}</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			{legacy ? (
				<TextField
					label={t("flash.sketchDir")}
					value={dir}
					onChange={(event) => setDir(event.target.value)}
				/>
			) : !project ? (
				<Typography color="secondary" variant="body2">
					{t("run.selectProject")}
				</Typography>
			) : listed.length === 0 ? (
				<Typography color="secondary" variant="body2">
					{t("run.noSketches")}
				</Typography>
			) : (
				<Select
					name="host-sketch"
					label={t("flash.sketch")}
					value={dir}
					onSelect={setDir}
				>
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
					{t("run.start")}
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
					{t("run.stop")}
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
					{t("run.startBle")}
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
					{t("run.stopBle")}
				</Button>
			</Stack>
			{error ? (
				<Alert severity="error">{translateError(t, error)}</Alert>
			) : null}
			<Typography color="secondary" variant="body2">
				{status?.running
					? t("run.running")
					: status?.last
						? status.last.ok
							? t("run.lastOk")
							: t("run.lastFailed")
						: t("run.thenRun")}
			</Typography>
			<Typography variant="caption" color="secondary">
				{t("common.serial", { status: consoleStatusLabel(serial.status, t) })}
			</Typography>
			{log ? (
				<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
					{log}
				</Typography>
			) : null}
		</Stack>
	);
}
