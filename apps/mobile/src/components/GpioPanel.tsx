import { useState } from "react";
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
	scanBoard,
	sendEnvelope,
} from "../lib/ble.ts";
import { Body, ErrorText, TextButton } from "./ui.tsx";

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

export default function GpioPanel({ uuid }: { uuid: string }) {
	const auth = useAuth();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const token = auth.token;
	const pins = snapshot?.pins.filter((pin) => pin.type === "gpio") ?? [];

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

	return (
		<View style={{ gap: 8, marginTop: 8 }}>
			<Body>GPIO</Body>
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
							const board = await scanBoard(loss);
							const session = await openBoardSession(board, loss);
							try {
								if (session.info.uuid && session.info.uuid !== uuid) {
									throw new Error(
										"this board is not the selected paired device",
									);
								}
								return parseGpioPayload(
									await sendEnvelope(session.device, envelope, loss),
								);
							} finally {
								session.disconnect();
							}
						});
					}}
				/>
			</View>
			{error ? <ErrorText>{error}</ErrorText> : null}
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{pins.map((pin) => (
					<TextButton
						key={pin.physical}
						label={pinLabel(pin)}
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
				))}
			</View>
		</View>
	);
}

function pinLabel(pin: GpioPinState): string {
	if (pin.reserved) {
		return `${pin.physical} reserved`;
	}
	if (pin.unresolved) {
		return `${pin.physical} ?`;
	}
	return `${pin.physical} ${pin.value ?? "-"}`;
}
