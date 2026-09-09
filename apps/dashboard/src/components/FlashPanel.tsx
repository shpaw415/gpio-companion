import { POST as signFlash } from "@api/device/flash";
import { GET as loadFlash, POST as startFlash } from "@api/flash";
import { GET as loadFlashPorts } from "@api/flash/ports";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	envelopeToPasteText,
	FLASH_PATH,
	FLASH_PORTS_PATH,
	type FlashPort,
	type FlashStatus,
	parseFlashPut,
} from "gpio-companion";
import { useCallback, useState } from "react";
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

export default function FlashPanel({ uuid }: { uuid: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<FlashStatus | null>(null);
	const [ports, setPorts] = useState<FlashPort[]>([]);
	const [fqbn, setFqbn] = useState("arduino:avr:uno");
	const [dir, setDir] = useState("");
	const [port, setPort] = useState("");
	const [pasteText, setPasteText] = useState("");
	const supported = bluetoothSupported();
	const offline = useOfflineBleKey(uuid);

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

	const onFlash = useCallback((next: FlashStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, { onFlash });

	const last = status?.last;

	return (
		<Stack spacing={1}>
			<Typography variant="subtitle1">Arduino flash</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} className="flex-wrap">
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							setStatus(unwrapAction(await loadFlash(uuid)));
							const listed = unwrapAction(await loadFlashPorts(uuid));
							setPorts(listed.ports);
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
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							const raw = await runFlashEnvelope(
								uuid,
								await withOfflineSign(
									uuid,
									async () =>
										unwrapAction(await signFlash({ uuid, ports: true })),
									{ method: "GET", path: FLASH_PORTS_PATH },
								),
								supported,
								(text) => setPasteText(text),
							);
							if (
								!raw ||
								typeof raw !== "object" ||
								!("ports" in raw) ||
								!Array.isArray((raw as { ports: unknown }).ports)
							) {
								return;
							}
							setPorts((raw as { ports: FlashPort[] }).ports);
						});
					}}
				>
					{supported ? "Ports over Bluetooth" : "Sign ports for Bluetooth"}
				</Button>
			</Stack>
			<TextField
				label="FQBN"
				value={fqbn}
				onChange={(event) => setFqbn(event.target.value)}
			/>
			<TextField
				label="Sketch dir on the Pi"
				placeholder="/home/gpio/blink"
				value={dir}
				onChange={(event) => setDir(event.target.value)}
			/>
			<TextField
				label="Port (optional)"
				placeholder="/dev/ttyUSB0"
				value={port}
				onChange={(event) => setPort(event.target.value)}
			/>
			<Stack direction="row" spacing={1} className="flex-wrap">
				<Button
					type="button"
					variant="contained"
					size="small"
					disabled={busy || !uuid || !fqbn.trim() || !dir.trim()}
					onClick={() => {
						start(async () => {
							unwrapAction(
								await startFlash({
									uuid,
									fqbn: fqbn.trim(),
									dir: dir.trim(),
									port: port.trim() || undefined,
								}),
							);
							setStatus(unwrapAction(await loadFlash(uuid)));
						});
					}}
				>
					Flash
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid || !fqbn.trim() || !dir.trim()}
					onClick={() => {
						start(async () => {
							await runFlashEnvelope(
								uuid,
								await withOfflineSign(
									uuid,
									async () =>
										unwrapAction(
											await signFlash({
												uuid,
												fqbn: fqbn.trim(),
												dir: dir.trim(),
												port: port.trim() || undefined,
											}),
										),
									{
										method: "POST",
										path: FLASH_PATH,
										body: JSON.stringify(
											parseFlashPut({
												fqbn: fqbn.trim(),
												dir: dir.trim(),
												port: port.trim() || undefined,
											}),
										),
									},
								),
								supported,
								(text) => setPasteText(text),
							);
							setStatus({ running: true, last: status?.last ?? null });
						});
					}}
				>
					{supported ? "Flash over Bluetooth" : "Sign flash for Bluetooth"}
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
					? "Flashing…"
					: last
						? last.ok
							? `Last flash ok · ${last.fqbn}`
							: `Last flash failed · ${last.fqbn}`
						: ports.length
							? `${ports.length} USB port(s)`
							: "C sketch on the Pi, then flash."}
			</Typography>
			{last?.log ? (
				<CopyBlock label="arduino-cli log" value={last.log} />
			) : null}
		</Stack>
	);
}

async function runFlashEnvelope(
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
		return parseFlashPayload(await ble.sendEnvelope(envelope as never));
	} finally {
		ble.disconnect();
	}
}

function parseFlashPayload(raw: string): unknown {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("board did not return flash");
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
