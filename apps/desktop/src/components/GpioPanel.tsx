import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useRef, useState } from "react";
import {
	bleGpio,
	type GpioPinState,
	type GpioSnapshot,
	loadGpio,
	putGpio,
} from "../api";
import { useSavedBleId } from "../hooks/useApiCache";
import { useGpioTunnel } from "../hooks/useGpioTunnel";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey";
import GpioHeader from "./GpioHeader";

function canDriveGpio(pin: GpioPinState): boolean {
	return pin.type === "gpio" && !pin.reserved && !pin.unresolved;
}

type GpioCommand = {
	physical: number;
	dir?: "in" | "out" | "pwm";
	value?: 0 | 1;
	analog?: number;
	op?: "tone" | "notone";
	hz?: number;
};

function applyCommand(
	snapshot: GpioSnapshot,
	command: GpioCommand,
): GpioSnapshot {
	return {
		...snapshot,
		pins: snapshot.pins.map((pin) => {
			if (pin.physical !== command.physical) {
				return pin;
			}
			if (command.op === "notone") {
				const next = { ...pin, dir: "in" as const };
				delete next.hz;
				delete next.analog;
				delete next.pwm;
				return next;
			}
			if (command.op === "tone") {
				const next = { ...pin, dir: "out" as const, hz: command.hz };
				delete next.analog;
				delete next.pwm;
				return next;
			}
			if (command.dir === "pwm") {
				const analog = command.analog ?? 0;
				const next = {
					...pin,
					dir: "pwm" as const,
					analog,
					pwm: Math.round((analog / 255) * 1000) / 10,
					value: analog >= 128 ? (1 as const) : (0 as const),
				};
				delete next.hz;
				return next;
			}
			if (command.dir === "in") {
				const next = { ...pin, dir: "in" as const };
				delete next.analog;
				delete next.pwm;
				delete next.hz;
				return next;
			}
			const next = {
				...pin,
				dir: "out" as const,
				value: command.value ?? 0,
			};
			delete next.analog;
			delete next.pwm;
			delete next.hz;
			return next;
		}),
	};
}

export default function GpioPanel({
	uuid,
	connected,
	poll = false,
}: {
	uuid: string;
	connected?: boolean;
	poll?: boolean;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const [selected, setSelected] = useState<number | undefined>();
	const snapshotRef = useRef<GpioSnapshot | null>(null);
	const pwmTimer = useRef(0);
	const offline = useOfflineBleKey(uuid);
	const bleId = useSavedBleId(uuid);
	const available = Boolean(uuid) && connected !== false;
	const pins = snapshot?.pins ?? [];
	const selectedPin = pins.find((pin) => pin.physical === selected);
	const onGpio = useCallback((next: GpioSnapshot) => {
		snapshotRef.current = next;
		setSnapshot(next);
	}, []);
	const tunnel = useGpioTunnel(poll && available ? uuid : "", onGpio, setError);

	function applySnapshot(next: GpioSnapshot | null) {
		snapshotRef.current = next;
		setSnapshot(next);
	}

	function start(task: () => Promise<GpioSnapshot>) {
		setBusy(true);
		setError("");
		void task()
			.then(applySnapshot)
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	function drive(command: GpioCommand) {
		const current = snapshotRef.current;
		if (current) {
			applySnapshot(applyCommand(current, command));
		}
		if (poll) {
			setError("");
			if (!tunnel.drive(command)) {
				setError("live gpio websocket is not connected");
			}
			return;
		}
		start(() => putGpio({ uuid, ...command }));
	}

	if (!available) {
		return (
			<Stack spacing={1} sx={{ mt: 1 }}>
				<Typography variant="subtitle2">GPIO</Typography>
				<Alert severity="info">Board not connected</Alert>
			</Stack>
		);
	}

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Stack
				direction="row"
				spacing={1}
				sx={{
					flexWrap: "wrap",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<Typography variant="subtitle2">
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
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
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
						start(() => loadGpio(uuid));
					}}
				>
					{busy ? "Loading…" : snapshot || poll ? "Refresh" : "Load GPIO"}
				</Button>
				{poll ? null : (
					<Button
						variant="outlined"
						size="small"
						disabled={busy || !uuid}
						onClick={() => {
							start(() => bleGpio({ uuid, id: bleId }));
						}}
					>
						Load over Bluetooth
					</Button>
				)}
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
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
					onDrive={drive}
					onPwm={(physical, analog) => {
						const command: GpioCommand = {
							physical,
							dir: "pwm",
							analog,
						};
						const current = snapshotRef.current;
						if (current) {
							applySnapshot(applyCommand(current, command));
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
	onDrive,
	onPwm,
}: {
	pin: GpioPinState | undefined;
	busy: boolean;
	onDrive: (command: GpioCommand) => void;
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
			<Stack
				direction="row"
				spacing={1}
				sx={{ flexWrap: "wrap", alignItems: "center" }}
			>
				<Typography variant="body2">
					Pin {pin.physical} {pin.name}
				</Typography>
				<PinStatusChip pin={pin} />
			</Stack>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					size="small"
					variant="outlined"
					disabled={busy || locked}
					onClick={() => onDrive({ physical: pin.physical, dir: "in" })}
				>
					In
				</Button>
				<Button
					size="small"
					variant="outlined"
					disabled={busy || locked}
					onClick={() =>
						onDrive({ physical: pin.physical, dir: "out", value: 1 })
					}
				>
					Set high
				</Button>
				<Button
					size="small"
					variant="outlined"
					disabled={busy || locked}
					onClick={() =>
						onDrive({ physical: pin.physical, dir: "out", value: 0 })
					}
				>
					Set low
				</Button>
				<Button
					size="small"
					variant="outlined"
					disabled={busy || locked}
					onClick={() =>
						onDrive({ physical: pin.physical, dir: "pwm", analog })
					}
				>
					PWM
				</Button>
				<Button
					size="small"
					variant="outlined"
					disabled={busy || locked}
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
					value={pin.analog}
					disabled={busy || locked}
					aria-label={`Pin ${pin.physical} PWM`}
					onChange={(event) => {
						onPwm(pin.physical, Number(event.target.value));
					}}
				/>
			) : null}
		</Stack>
	);
}

function PinStatusChip({ pin }: { pin: GpioPinState }) {
	const label = pinStatus(pin);
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

function pinStatus(pin: GpioPinState): string {
	if (pin.reserved) {
		return "Reserved";
	}
	if (pin.unresolved) {
		return "Unresolved";
	}
	if (typeof pin.hz === "number") {
		return `tone ${Math.round(pin.hz)} Hz`;
	}
	if (typeof pin.analog === "number") {
		return `PWM ${Math.round(pin.analog)}/255`;
	}
	if (typeof pin.pwm === "number") {
		return `PWM ${Math.round(pin.pwm)}%`;
	}
	const level = pin.value === 1 ? "high" : pin.value === 0 ? "low" : undefined;
	if (pin.dir === "in" || pin.dir === "out") {
		return level ? `${pin.dir} · ${level}` : pin.dir;
	}
	return level ?? "—";
}
