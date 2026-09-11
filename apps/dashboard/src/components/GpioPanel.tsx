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
	canDriveGpio,
	envelopeToPasteText,
	GPIO_PATH,
	type GpioPinState,
	type GpioSnapshot,
} from "gpio-companion";
import { useCallback, useState } from "react";
import { useGpioTunnel } from "../hooks/useGpioTunnel.ts";
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
import GpioHeader from "./GpioHeader.tsx";

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

	useGpioTunnel(poll && available ? uuid : "", applySnapshot);

	const pins = snapshot?.pins ?? [];
	const gpioPins = pins.filter((pin) => pin.type === "gpio");

	function drive(pin: GpioPinState, dir: "in" | "out", value?: 0 | 1) {
		start(async () => {
			applySnapshot(
				unwrapAction(
					await putGpio({
						uuid,
						physical: pin.physical,
						dir,
						value,
					}),
				),
			);
		});
	}

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
			<Stack
				direction="row"
				spacing={1}
				className="flex-wrap items-center justify-between"
			>
				<Typography variant="subtitle1">
					{poll ? "Live GPIO" : "GPIO"}
				</Typography>
				{poll ? (
					<Chip
						label={snapshot ? "Live" : "Waiting"}
						size="small"
						color={snapshot ? "success" : "secondary"}
						variant="outlined"
					/>
				) : null}
			</Stack>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			{poll ? (
				<Typography variant="body2" color="secondary">
					{snapshot
						? "Tap a GPIO to toggle output. Set In to watch a pin."
						: "Waiting for live pin state from the board."}
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
					{busy ? "Loading…" : snapshot || poll ? "Refresh" : "Load GPIO"}
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
			{poll || snapshot ? (
				<GpioHeader
					pins={pins}
					busy={busy}
					interactive={Boolean(snapshot)}
					onToggle={(pin) => {
						drive(pin, "out", pin.value === 1 ? 0 : 1);
					}}
				/>
			) : (
				<Typography color="secondary" variant="body2">
					Load GPIO to see live pin status.
				</Typography>
			)}
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
								const locked = !canDriveGpio(pin);
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
											<Stack direction="row" spacing={1} className="flex-wrap">
												<Button
													type="button"
													size="small"
													variant="outlined"
													disabled={busy || !uuid || locked}
													onClick={() => drive(pin, "in")}
												>
													In
												</Button>
												<Button
													type="button"
													size="small"
													variant="outlined"
													disabled={busy || !uuid || locked}
													onClick={() =>
														drive(pin, "out", pin.value === 1 ? 0 : 1)
													}
												>
													{pin.value === 1 ? "Set low" : "Set high"}
												</Button>
											</Stack>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</TableContainer>
			) : null}
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
	const ble = await connectGpioCompanionBle(uuid);
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
