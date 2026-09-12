import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import {
	type GpioPinState,
	type GpioSnapshot,
	loadGpio,
	putGpio,
	signGpio,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { useGpioTunnel } from "../lib/use-gpio-tunnel.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import GpioHeader from "./GpioHeader.tsx";
import { Body, Chip, ErrorText, Muted, TextButton } from "./ui.tsx";

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

export default function GpioPanel({
	uuid,
	connected,
	poll = false,
}: {
	uuid: string;
	connected?: boolean;
	poll?: boolean;
}) {
	const auth = useAuth();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const [selected, setSelected] = useState<number | undefined>();
	const snapshotRef = useRef<GpioSnapshot | null>(null);
	const token = auth.token;
	const offline = useOfflineBleKey(uuid);
	const pins = snapshot?.pins ?? [];
	const selectedPin = pins.find((pin) => pin.physical === selected);
	const available = Boolean(uuid) && connected !== false;
	const onGpio = useCallback((next: GpioSnapshot) => {
		snapshotRef.current = next;
		setSnapshot(next);
	}, []);
	const tunnel = useGpioTunnel(
		poll && available ? uuid : "",
		token,
		onGpio,
		setError,
	);

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
		if (!token) {
			return;
		}
		start(() => putGpio(token, { uuid, ...command }));
	}

	if (!available) {
		return (
			<View style={{ gap: 8, marginTop: 8 }}>
				<Body>GPIO</Body>
				<Muted>Board not connected</Muted>
			</View>
		);
	}

	return (
		<View style={{ gap: 8, marginTop: 8 }}>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
				}}
			>
				<Body>{poll ? "Live GPIO" : "GPIO"}</Body>
				{poll ? (
					<LiveChip status={tunnel.status} ready={Boolean(snapshot)} />
				) : null}
			</View>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			{poll ? (
				<Muted>
					{snapshot
						? "Tap a GPIO pin, then set In, high, or low."
						: "Waiting for live pin state from the board."}
				</Muted>
			) : null}
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				<TextButton
					label={busy ? "Loading…" : snapshot || poll ? "Refresh" : "Load GPIO"}
					disabled={busy || !uuid || !token}
					onPress={() => {
						if (poll) {
							setError("");
							if (!tunnel.refresh()) {
								setError("live gpio websocket is not connected");
							}
							return;
						}
						if (!token) {
							return;
						}
						start(() => loadGpio(token, uuid));
					}}
				/>
				{poll ? null : (
					<TextButton
						label="Load over Bluetooth"
						disabled={busy || !uuid || !token}
						onPress={() => {
							if (!token) {
								return;
							}
							start(async () => {
								const envelope = await signGpio(token, { uuid });
								const paired = await openPairedBoard(uuid, { token });
								try {
									return parseGpioPayload(
										await sendEnvelope(
											paired.session.device,
											envelope,
											paired.loss,
										),
									);
								} finally {
									await paired.session.close();
								}
							});
						}}
					/>
				)}
			</View>
			{error ? <ErrorText>{error}</ErrorText> : null}
			{poll || snapshot ? (
				<GpioHeader
					pins={pins}
					busy={busy}
					interactive={Boolean(snapshot)}
					selected={selected}
					onSelect={(pin) => setSelected(pin.physical)}
				/>
			) : (
				<Muted>Load GPIO to see live pin status.</Muted>
			)}
			{snapshot ? (
				<GpioPinActions
					pin={selectedPin}
					busy={busy}
					disabled={!token}
					onDrive={drive}
				/>
			) : null}
		</View>
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
		return <Chip label="Reconnecting" tone="warning" />;
	}
	if (status === "connecting" || !ready) {
		return (
			<Chip
				label={status === "connecting" ? "Connecting" : "Waiting"}
				tone="muted"
			/>
		);
	}
	return <Chip label="Live" tone="success" />;
}

function GpioPinActions({
	pin,
	busy,
	disabled,
	onDrive,
}: {
	pin: GpioPinState | undefined;
	busy: boolean;
	disabled: boolean;
	onDrive: (command: GpioCommand) => void;
}) {
	if (!pin) {
		return <Muted>Tap a GPIO pin to drive it.</Muted>;
	}
	const locked = !canDriveGpio(pin) || disabled;
	const analog = typeof pin.analog === "number" ? pin.analog : 128;
	return (
		<View style={{ gap: 8 }}>
			<View>
				<Body>
					Pin {pin.physical} {pin.name}
				</Body>
				<Muted>{pinStatus(pin)}</Muted>
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				<TextButton
					label="In"
					disabled={busy || locked}
					onPress={() => onDrive({ physical: pin.physical, dir: "in" })}
				/>
				<TextButton
					label="Set high"
					disabled={busy || locked}
					onPress={() =>
						onDrive({ physical: pin.physical, dir: "out", value: 1 })
					}
				/>
				<TextButton
					label="Set low"
					disabled={busy || locked}
					onPress={() =>
						onDrive({ physical: pin.physical, dir: "out", value: 0 })
					}
				/>
				<TextButton
					label="PWM"
					disabled={busy || locked}
					onPress={() =>
						onDrive({ physical: pin.physical, dir: "pwm", analog })
					}
				/>
				<TextButton
					label={typeof pin.hz === "number" ? "Stop" : "Tone"}
					disabled={busy || locked}
					onPress={() =>
						onDrive(
							typeof pin.hz === "number"
								? { physical: pin.physical, op: "notone" }
								: { physical: pin.physical, op: "tone", hz: 440 },
						)
					}
				/>
			</View>
		</View>
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
