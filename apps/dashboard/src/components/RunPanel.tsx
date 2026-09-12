import { POST as signRun } from "@api/device/run";
import { GET as loadRun, POST as startRun } from "@api/run";
import { GET as loadRunSketches } from "@api/run/sketches";
import { POST as stopRun } from "@api/run/stop";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	type BoardSketch,
	envelopeToPasteText,
	parseRunPut,
	RUN_PATH,
	RUN_STOP_PATH,
	type RunStatus,
} from "gpio-companion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeviceHub } from "../hooks/useDeviceHub.ts";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey.ts";
import { unwrapAction } from "../lib/action.ts";
import { withOfflineSign } from "../lib/offline-ble.ts";
import {
	bluetoothChooserCancelled,
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";
import CopyBlock from "./CopyBlock.tsx";

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
	const [pasteText, setPasteText] = useState("");
	const supported = bluetoothSupported();
	const offline = useOfflineBleKey(uuid);
	const listed = useMemo(
		() => sketches.filter((item) => !project || item.project === project),
		[sketches, project],
	);

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
				setSketches(unwrapAction(result).sketches);
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
		setPasteText("");
		void task()
			.catch((caught) => {
				if (bluetoothChooserCancelled(caught)) {
					return;
				}
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	const onRun = useCallback((next: RunStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, { onRun });

	const last = status?.last;
	const log = status?.log || last?.log || "";
	const canStart = Boolean(dir.trim()) && (legacy || Boolean(project));

	return (
		<Stack spacing={1}>
			<Typography variant="subtitle1">Run on board</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			{legacy ? (
				<TextField
					label="Sketch dir on the Pi"
					placeholder="/home/gpio/blink"
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
				<Select
					name="host-sketch"
					label="Sketch"
					value={dir}
					onSelect={setDir}
					className="w-full"
				>
					{listed.map((item) => (
						<option key={item.dir} value={item.dir}>
							{item.name}
						</option>
					))}
				</Select>
			)}
			<Stack direction="row" spacing={1} className="flex-wrap">
				<Button
					type="button"
					variant="contained"
					size="small"
					disabled={busy || !uuid || !canStart}
					onClick={() => {
						start(async () => {
							unwrapAction(await startRun({ uuid, dir: dir.trim() }));
							setStatus(unwrapAction(await loadRun(uuid)));
						});
					}}
				>
					Start
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							unwrapAction(await stopRun(uuid));
							setStatus(unwrapAction(await loadRun(uuid)));
						});
					}}
				>
					Stop
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid || !canStart}
					onClick={() => {
						start(async () => {
							await runEnvelope(
								uuid,
								await withOfflineSign(
									uuid,
									async () =>
										unwrapAction(await signRun({ uuid, dir: dir.trim() })),
									{
										method: "POST",
										path: RUN_PATH,
										body: JSON.stringify(parseRunPut({ dir: dir.trim() })),
									},
								),
								supported,
								(text) => setPasteText(text),
							);
							setStatus({
								running: true,
								log: status?.log ?? "",
								last: status?.last ?? null,
							});
						});
					}}
				>
					{supported ? "Start over Bluetooth" : "Sign start for Bluetooth"}
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							await runEnvelope(
								uuid,
								await withOfflineSign(
									uuid,
									async () => unwrapAction(await signRun({ uuid, stop: true })),
									{ method: "POST", path: RUN_STOP_PATH, body: "{}" },
								),
								supported,
								(text) => setPasteText(text),
							);
						});
					}}
				>
					{supported ? "Stop over Bluetooth" : "Sign stop for Bluetooth"}
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{supported ? null : pasteText ? (
				<>
					<CopyBlock label="Bluetooth name" value={BLE_DEVICE_NAME} />
					<CopyBlock label="Write characteristic" value={BLE_CMD_UUID} />
					<CopyBlock label="Signed Bluetooth command" value={pasteText} />
				</>
			) : null}
			<Typography color="secondary" variant="body2">
				{status?.running
					? "Running on companion GPIO…"
					: last
						? last.ok
							? "Last run exited 0"
							: "Last run failed"
						: "C sketch on the Pi, then run on this header."}
			</Typography>
			{log ? <CopyBlock label="run log" value={log} /> : null}
		</Stack>
	);
}

async function runEnvelope(
	uuid: string,
	envelope: unknown,
	supported: boolean,
	onPaste: (text: string) => void,
): Promise<unknown> {
	if (!supported) {
		const text = envelopeToPasteText(
			envelope as Parameters<typeof envelopeToPasteText>[0],
		);
		onPaste(text);
		await navigator.clipboard.writeText(text).catch(() => undefined);
		return null;
	}
	const ble = await connectGpioCompanionBle(uuid);
	try {
		if (ble.info.uuid && ble.info.uuid !== uuid) {
			throw new Error("this board is not the selected paired device");
		}
		return parseRunPayload(await ble.sendEnvelope(envelope as never));
	} finally {
		ble.disconnect();
	}
}

function parseRunPayload(raw: string): unknown {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("board did not return run");
	}
	if (
		parsed &&
		typeof parsed === "object" &&
		"error" in parsed &&
		typeof (parsed as { error?: unknown }).error === "string"
	) {
		throw new Error((parsed as { error: string }).error);
	}
	return parsed;
}
