import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	type BoardSketch,
	bleFlash,
	type FlashStatus,
	loadFlash,
	loadFlashPorts,
	loadFlashSketches,
	startFlash,
	startUsbConsole,
	stopUsbConsole,
} from "../api";
import { useSavedBleId } from "../hooks/useApiCache";
import { useConsoleTunnel } from "../hooks/useConsoleTunnel";
import { useDeviceHub } from "../hooks/useDeviceHub";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";

export default function FlashPanel({
	uuid,
	project,
}: {
	uuid: string;
	project?: string;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<FlashStatus | null>(null);
	const [fqbn, setFqbn] = useState("arduino:avr:uno");
	const [dir, setDir] = useState("");
	const [port, setPort] = useState("");
	const [sketches, setSketches] = useState<BoardSketch[]>([]);
	const [legacy, setLegacy] = useState(false);
	const offline = useOfflineBleKey(uuid);
	const bleId = useSavedBleId(uuid);
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
		loadFlashSketches(uuid)
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
	const onFlash = useCallback((next: FlashStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, { onFlash });
	const serial = useConsoleTunnel(uuid, setError);
	const canFlash =
		Boolean(fqbn.trim()) && Boolean(dir.trim()) && (legacy || Boolean(project));

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">Arduino flash</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			<Button
				variant="outlined"
				size="small"
				disabled={busy || !uuid}
				onClick={() => {
					start(async () => {
						setStatus(await loadFlash(uuid));
						const listed = await loadFlashPorts(uuid);
						const first = listed.ports[0];
						if (first?.fqbn) {
							setFqbn(first.fqbn);
						}
						if (first?.address) {
							setPort(first.address);
						}
					});
				}}
			>
				{busy ? "Loading…" : "Load ports"}
			</Button>
			<TextField
				label="FQBN"
				value={fqbn}
				onChange={(event) => setFqbn(event.target.value)}
			/>
			{legacy ? (
				<TextField
					label="Sketch dir on the Pi"
					value={dir}
					onChange={(event) => setDir(event.target.value)}
				/>
			) : !project ? (
				<Typography color="secondary" variant="body2">
					Select a project to see firmware sketches on this board.
				</Typography>
			) : listed.length === 0 ? (
				<Typography color="secondary" variant="body2">
					No USB sketches on this board for this project. Ask Code to write them
					under firmware/.
				</Typography>
			) : (
				<Select
					name="firmware-sketch"
					label="Sketch"
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
			<TextField
				label="Port (optional)"
				value={port}
				onChange={(event) => setPort(event.target.value)}
			/>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !port.trim() || Boolean(status?.running)}
					onClick={() => {
						start(async () => {
							await startUsbConsole({ uuid, port: port.trim() });
						});
					}}
				>
					Open serial
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy}
					onClick={() => {
						start(async () => {
							await stopUsbConsole(uuid);
						});
					}}
				>
					Close serial
				</Button>
			</Stack>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="contained"
					size="small"
					disabled={busy || !canFlash}
					onClick={() => {
						start(async () => {
							await startFlash({
								uuid,
								fqbn: fqbn.trim(),
								dir: dir.trim(),
								port: port.trim() || undefined,
							});
							setStatus(await loadFlash(uuid));
						});
					}}
				>
					Flash
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !canFlash}
					onClick={() => {
						start(async () => {
							await bleFlash({
								uuid,
								id: bleId,
								fqbn: fqbn.trim(),
								dir: dir.trim(),
								port: port.trim() || undefined,
							});
						});
					}}
				>
					Flash over Bluetooth
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			<Typography color="secondary" variant="body2">
				{status?.running
					? "Flashing…"
					: status?.last
						? status.last.ok
							? `Last flash ok · ${status.last.fqbn}`
							: `Last flash failed · ${status.last.fqbn}`
						: "C sketch on the Pi, then flash."}
			</Typography>
			<Typography variant="caption" color="secondary">
				Serial {serial.status}
			</Typography>
			{serial.snapshot.usb.log ? (
				<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
					{serial.snapshot.usb.log}
				</Typography>
			) : null}
		</Stack>
	);
}
