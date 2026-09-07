import { POST as signGpio } from "@api/device/gpio";
import { GET as loadGpio, PUT as putGpio } from "@api/gpio";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Stack from "@shpaw415/mui-lite/Stack";
import Table, {
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	envelopeToPasteText,
	GPIO_PATH,
	type GpioPinState,
	type GpioSnapshot,
} from "gpio-companion";
import { useCallback, useState } from "react";
import { useDeviceHub } from "../hooks/useDeviceHub.ts";
import useMobile from "../hooks/useMobile.ts";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey.ts";
import { unwrapAction } from "../lib/action.ts";
import { withOfflineSign } from "../lib/offline-ble.ts";
import {
	bluetoothChooserCancelled,
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";
import CopyBlock from "./CopyBlock.tsx";

export default function GpioPanel({
	uuid,
	poll = false,
	connected,
	onSnapshot,
}: {
	uuid: string;
	poll?: boolean;
	connected?: boolean;
	onSnapshot?: (snapshot: GpioSnapshot | null) => void;
}) {
	const mobile = useMobile();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const [pasteText, setPasteText] = useState("");
	const supported = bluetoothSupported();
	const offline = useOfflineBleKey(uuid);
	const available = Boolean(uuid) && connected !== false;

	const applySnapshot = useCallback(
		(next: GpioSnapshot | null) => {
			setSnapshot(next);
			onSnapshot?.(next);
		},
		[onSnapshot],
	);

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

	useDeviceHub(poll && available ? uuid : "", {
		onGpio: applySnapshot,
	});

	const gpioPins = snapshot?.pins.filter((pin) => pin.type === "gpio") ?? [];

	if (!available) {
		return (
			<Stack spacing={1}>
				<Typography variant="subtitle1">GPIO</Typography>
				<Alert severity="info">Board not connected</Alert>
			</Stack>
		);
	}

	return (
		<Stack spacing={1}>
			<Typography variant="subtitle1">GPIO</Typography>
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
							applySnapshot(unwrapAction(await loadGpio(uuid)));
						});
					}}
				>
					{busy ? "Loading…" : "Load GPIO"}
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							applySnapshot(
								await runGpioEnvelope(
									uuid,
									await withOfflineSign(
										uuid,
										async () => unwrapAction(await signGpio({ uuid })),
										{ method: "GET", path: GPIO_PATH },
									),
									supported,
									(text) => setPasteText(text),
								),
							);
						});
					}}
				>
					{supported ? "Load over Bluetooth" : "Sign GPIO for Bluetooth"}
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
			{snapshot ? (
				<TableContainer>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>Pin</TableCell>
								<TableCell>Name</TableCell>
								{mobile ? null : <TableCell>Direction</TableCell>}
								<TableCell>Status</TableCell>
								<TableCell>Action</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{gpioPins.map((pin) => {
								const locked = Boolean(pin.reserved || pin.unresolved);
								return (
									<TableRow key={pin.physical}>
										<TableCell>{pin.physical}</TableCell>
										<TableCell>{pin.name}</TableCell>
										{mobile ? null : (
											<TableCell>
												{pin.dir === "in" || pin.dir === "out" ? pin.dir : "—"}
											</TableCell>
										)}
										<TableCell>
											<PinStatusChip pin={pin} />
										</TableCell>
										<TableCell>
											<Button
												type="button"
												size="small"
												variant="outlined"
												disabled={busy || !uuid || locked}
												onClick={() => {
													start(async () => {
														const nextValue = pin.value === 1 ? 0 : 1;
														applySnapshot(
															unwrapAction(
																await putGpio({
																	uuid,
																	physical: pin.physical,
																	dir: "out",
																	value: nextValue,
																}),
															),
														);
													});
												}}
											>
												Toggle
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</TableContainer>
			) : (
				<Typography color="secondary" variant="body2">
					Load GPIO to see live pin status.
				</Typography>
			)}
		</Stack>
	);
}

function PinStatusChip({ pin }: { pin: GpioPinState }) {
	if (pin.reserved) {
		return <Chip label="Reserved" size="small" variant="outlined" />;
	}
	if (pin.unresolved) {
		return <Chip label="Unresolved" size="small" variant="outlined" />;
	}
	if (pin.value === 1) {
		return (
			<Chip label="High" size="small" color="success" variant="outlined" />
		);
	}
	if (pin.value === 0) {
		return (
			<Chip label="Low" size="small" color="secondary" variant="outlined" />
		);
	}
	return <Chip label="—" size="small" variant="outlined" />;
}

async function runGpioEnvelope(
	uuid: string,
	envelope: unknown,
	supported: boolean,
	onPaste: (text: string) => void,
): Promise<GpioSnapshot | null> {
	if (!supported) {
		const text = envelopeToPasteText(
			envelope as Parameters<typeof envelopeToPasteText>[0],
		);
		onPaste(text);
		await navigator.clipboard.writeText(text).catch(() => undefined);
		return null;
	}
	const ble = await connectGpioCompanionBle();
	try {
		if (ble.info.uuid && ble.info.uuid !== uuid) {
			throw new Error("this board is not the selected paired device");
		}
		return parseGpioPayload(await ble.sendEnvelope(envelope as never));
	} finally {
		ble.disconnect();
	}
}

function parseGpioPayload(raw: string): GpioSnapshot {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("board did not return gpio");
	}
	if (
		parsed &&
		typeof parsed === "object" &&
		"error" in parsed &&
		typeof (parsed as { error?: unknown }).error === "string"
	) {
		throw new Error((parsed as { error: string }).error);
	}
	const snap = parsed as GpioSnapshot;
	if (!snap || !Array.isArray(snap.pins)) {
		throw new Error("board did not return gpio");
	}
	return snap;
}
