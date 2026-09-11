import { useCallback, useState } from "react";
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
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import GpioHeader from "./GpioHeader.tsx";
import { Body, Chip, ErrorText, Muted, TextButton } from "./ui.tsx";

function canDriveGpio(pin: GpioPinState): boolean {
	return pin.type === "gpio" && !pin.reserved && !pin.unresolved;
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
	const token = auth.token;
	const offline = useOfflineBleKey(uuid);
	const pins = snapshot?.pins ?? [];
	const gpioPins = pins.filter((pin) => pin.type === "gpio");
	const available = Boolean(uuid) && connected !== false;
	const onGpio = useCallback((next: GpioSnapshot) => {
		setSnapshot(next);
	}, []);
	useDeviceHub(poll && available ? uuid : "", token, { onGpio });

	function start(task: () => Promise<GpioSnapshot>) {
		setBusy(true);
		setError("");
		void task()
			.then(setSnapshot)
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	function drive(pin: GpioPinState, dir: "in" | "out", value?: 0 | 1) {
		if (!token) {
			return;
		}
		start(() =>
			putGpio(token, {
				uuid,
				physical: pin.physical,
				dir,
				value,
			}),
		);
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
					<Chip
						label={snapshot ? "Live" : "Waiting"}
						tone={snapshot ? "success" : "muted"}
					/>
				) : null}
			</View>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			{poll ? (
				<Muted>
					{snapshot
						? "Tap a GPIO to toggle output. Set In to watch a pin."
						: "Waiting for live pin state from the board."}
				</Muted>
			) : null}
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				<TextButton
					label={busy ? "Loading…" : snapshot || poll ? "Refresh" : "Load GPIO"}
					disabled={busy || !uuid || !token}
					onPress={() => {
						if (!token) {
							return;
						}
						start(() => loadGpio(token, uuid));
					}}
				/>
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
			</View>
			{error ? <ErrorText>{error}</ErrorText> : null}
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
				<Muted>Load GPIO to see live pin status.</Muted>
			)}
			{snapshot ? (
				<View style={{ gap: 8 }}>
					{gpioPins.map((pin) => (
						<View
							key={pin.physical}
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 8,
							}}
						>
							<View style={{ flex: 1 }}>
								<Body>
									{pin.physical} {pin.name}
								</Body>
								<Muted>{pinStatus(pin)}</Muted>
							</View>
							<TextButton
								label="In"
								disabled={busy || !canDriveGpio(pin) || !token}
								onPress={() => drive(pin, "in")}
							/>
							<TextButton
								label={pin.value === 1 ? "Set low" : "Set high"}
								disabled={busy || !canDriveGpio(pin) || !token}
								onPress={() => drive(pin, "out", pin.value === 1 ? 0 : 1)}
							/>
						</View>
					))}
				</View>
			) : null}
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
	if (pin.value === 1) {
		return "High";
	}
	if (pin.value === 0) {
		return "Low";
	}
	return "—";
}
