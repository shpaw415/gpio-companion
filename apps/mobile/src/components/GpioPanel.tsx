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
import {
	createBoardLoss,
	openBoardSession,
	readInfo,
	scanBoard,
	sendEnvelope,
} from "../lib/ble.ts";
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import { Body, ErrorText, Muted, TextButton } from "./ui.tsx";

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
	const pins = snapshot?.pins.filter((pin) => pin.type === "gpio") ?? [];
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
			<Body>GPIO</Body>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				<TextButton
					label={busy ? "Loading…" : "Load GPIO"}
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
							const loss = createBoardLoss();
							const board = await scanBoard();
							const session = await openBoardSession(board, (why) =>
								loss.lose(why),
							);
							try {
								const bleInfo = await readInfo(session.device);
								if (bleInfo.uuid && bleInfo.uuid !== uuid) {
									throw new Error(
										"this board is not the selected paired device",
									);
								}
								return parseGpioPayload(
									await sendEnvelope(session.device, envelope, loss),
								);
							} finally {
								await session.close();
							}
						});
					}}
				/>
			</View>
			{error ? <ErrorText>{error}</ErrorText> : null}
			{snapshot ? (
				<View style={{ gap: 8 }}>
					{pins.map((pin) => (
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
								label="Toggle"
								disabled={busy || pin.reserved || pin.unresolved || !token}
								onPress={() => {
									if (!token) {
										return;
									}
									start(() =>
										putGpio(token, {
											uuid,
											physical: pin.physical,
											dir: "out",
											value: pin.value === 1 ? 0 : 1,
										}),
									);
								}}
							/>
						</View>
					))}
				</View>
			) : (
				<Muted>Load GPIO to see live pin status.</Muted>
			)}
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
