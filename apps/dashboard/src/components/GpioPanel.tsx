import { POST as signGpio } from "@api/device/gpio";
import { GET as loadGpio, PUT as putGpio } from "@api/gpio";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	applyGpioApply,
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	canDriveGpio,
	envelopeToPasteText,
	GPIO_PATH,
	type GpioApply,
	type GpioPinState,
	type GpioSnapshot,
	gpioLiveValues,
	gpioPinStatusLabel,
} from "gpio-companion";
import { useCallback, useRef, useState } from "react";
import { useGpioTunnel } from "../hooks/useGpioTunnel.ts";
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
	onLivePins,
}: {
	uuid: string;
	poll?: boolean;
	connected?: boolean;
	onSnapshot?: (snapshot: GpioSnapshot | null) => void;
	onLivePins?: (pins: Record<number, 0 | 1>) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const [selected, setSelected] = useState<number | undefined>();
	const [pasteText, setPasteText] = useState("");
	const livePinsRef = useRef("");
	const snapshotRef = useRef<GpioSnapshot | null>(null);
	const pwmTimer = useRef(0);
	const supported = bluetoothSupported();
	const offline = useOfflineBleKey(uuid);
	const available = Boolean(uuid) && connected !== false;

	const applySnapshot = useCallback(
		(next: GpioSnapshot | null) => {
			snapshotRef.current = next;
			setSnapshot(next);
			onSnapshot?.(next);
			const live = gpioLiveValues(next);
			const key = JSON.stringify(live);
			if (key !== livePinsRef.current) {
				livePinsRef.current = key;
				onLivePins?.(live);
			}
		},
		[onSnapshot, onLivePins],
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

	const tunnel = useGpioTunnel(
		poll && available ? uuid : "",
		applySnapshot,
		setError,
	);

	const pins = snapshot?.pins ?? [];
	const selectedPin = pins.find((pin) => pin.physical === selected);

	function drive(command: GpioApply) {
		const current = snapshotRef.current;
		if (current) {
			applySnapshot(applyGpioApply(current, command));
		}
		if (poll) {
			setError("");
			if (!tunnel.drive(command)) {
				setError("live gpio websocket is not connected");
			}
			return;
		}
		start(async () => {
			applySnapshot(unwrapAction(await putGpio({ uuid, ...command })));
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
					<LiveChip status={tunnel.status} ready={Boolean(snapshot)} />
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
						? "Tap a GPIO pin, then set In, high, or low."
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
						if (poll) {
							setError("");
							if (!tunnel.refresh()) {
								setError("live gpio websocket is not connected");
							}
							return;
						}
						start(async () => {
							applySnapshot(unwrapAction(await loadGpio(uuid)));
						});
					}}
				>
					{busy ? "Loading…" : snapshot || poll ? "Refresh" : "Load GPIO"}
				</Button>
				{poll ? null : (
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
				)}
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{supported || poll ? null : pasteText ? (
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
					selected={selected}
					onSelect={(pin) => setSelected(pin.physical)}
				/>
			) : (
				<Typography color="secondary" variant="body2">
					Load GPIO to see live pin status.
				</Typography>
			)}
			{snapshot ? (
				<GpioPinActions
					pin={selectedPin}
					busy={busy}
					disabled={!uuid}
					onDrive={drive}
					onPwm={(physical, analog) => {
						const command: GpioApply = {
							physical,
							dir: "pwm",
							analog,
						};
						const current = snapshotRef.current;
						if (current) {
							applySnapshot(applyGpioApply(current, command));
						}
						window.clearTimeout(pwmTimer.current);
						pwmTimer.current = window.setTimeout(() => {
							if (poll) {
								setError("");
								if (!tunnel.drive(command)) {
									setError("live gpio websocket is not connected");
								}
								return;
							}
							drive(command);
						}, 150);
					}}
				/>
			) : null}
		</Stack>
	);
}

function LiveChip({
	status,
	ready,
}: {
	status: "idle" | "connecting" | "live" | "reconnecting";
	ready: boolean;
}) {
	if (status === "reconnecting") {
		return (
			<Chip
				label="Reconnecting"
				size="small"
				color="warning"
				variant="outlined"
			/>
		);
	}
	if (status === "connecting" || !ready) {
		return (
			<Chip
				label={status === "connecting" ? "Connecting" : "Waiting"}
				size="small"
				color="secondary"
				variant="outlined"
			/>
		);
	}
	return <Chip label="Live" size="small" color="success" variant="outlined" />;
}

function GpioPinActions({
	pin,
	busy,
	disabled,
	onDrive,
	onPwm,
}: {
	pin: GpioPinState | undefined;
	busy: boolean;
	disabled: boolean;
	onDrive: (command: GpioApply) => void;
	onPwm: (physical: number, analog: number) => void;
}) {
	if (!pin) {
		return (
			<Typography color="secondary" variant="body2">
				Tap a GPIO pin to drive it.
			</Typography>
		);
	}
	const locked = !canDriveGpio(pin);
	const analog = typeof pin.analog === "number" ? pin.analog : 128;
	return (
		<Stack spacing={1}>
			<Stack direction="row" spacing={1} className="flex-wrap items-center">
				<Typography variant="body2">
					Pin {pin.physical} {pin.name}
				</Typography>
				<PinStatusChip pin={pin} />
			</Stack>
			<Stack direction="row" spacing={1} className="flex-wrap">
				<Button
					type="button"
					size="small"
					variant="outlined"
					disabled={busy || disabled || locked}
					onClick={() => onDrive({ physical: pin.physical, dir: "in" })}
				>
					In
				</Button>
				<Button
					type="button"
					size="small"
					variant="outlined"
					disabled={busy || disabled || locked}
					onClick={() =>
						onDrive({
							physical: pin.physical,
							dir: "out",
							value: 1,
						})
					}
				>
					Set high
				</Button>
				<Button
					type="button"
					size="small"
					variant="outlined"
					disabled={busy || disabled || locked}
					onClick={() =>
						onDrive({
							physical: pin.physical,
							dir: "out",
							value: 0,
						})
					}
				>
					Set low
				</Button>
				<Button
					type="button"
					size="small"
					variant="outlined"
					disabled={busy || disabled || locked}
					onClick={() =>
						onDrive({
							physical: pin.physical,
							dir: "pwm",
							analog,
						})
					}
				>
					PWM
				</Button>
				<Button
					type="button"
					size="small"
					variant="outlined"
					disabled={busy || disabled || locked}
					onClick={() =>
						onDrive(
							typeof pin.hz === "number"
								? { physical: pin.physical, op: "notone" }
								: { physical: pin.physical, op: "tone", hz: 440 },
						)
					}
				>
					{typeof pin.hz === "number" ? "Stop tone" : "Tone"}
				</Button>
			</Stack>
			{typeof pin.analog === "number" ? (
				<input
					type="range"
					min={0}
					max={255}
					step={1}
					value={pin.analog}
					disabled={busy || disabled || locked}
					aria-label={`Pin ${pin.physical} PWM`}
					onChange={(event) => {
						const next = Number(event.target.value);
						if (!Number.isInteger(next) || next < 0 || next > 255) {
							return;
						}
						onPwm(pin.physical, next);
					}}
				/>
			) : null}
		</Stack>
	);
}

function PinStatusChip({ pin }: { pin: GpioPinState }) {
	const label = gpioPinStatusLabel(pin);
	if (pin.reserved || pin.unresolved || label === "—") {
		return <Chip label={label} size="small" variant="outlined" />;
	}
	if (typeof pin.hz === "number" || typeof pin.analog === "number") {
		return (
			<Chip label={label} size="small" color="primary" variant="outlined" />
		);
	}
	if (pin.value === 1) {
		return (
			<Chip label={label} size="small" color="success" variant="outlined" />
		);
	}
	return (
		<Chip label={label} size="small" color="secondary" variant="outlined" />
	);
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
