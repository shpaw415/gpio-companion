import { useCallback, useState } from "react";
import { View } from "react-native";
import {
	loadRun,
	type RunStatus,
	signRun,
	startRun,
	stopRun,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import { Body, ErrorText, Field, Muted, TextButton } from "./ui.tsx";

export default function RunPanel({ uuid }: { uuid: string }) {
	const auth = useAuth();
	const token = auth.token;
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<RunStatus | null>(null);
	const [dir, setDir] = useState("");
	const offline = useOfflineBleKey(uuid);
	const onRun = useCallback((next: RunStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, token, { onRun });

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	const log = status?.log || status?.last?.log || "";

	return (
		<View style={{ gap: 8, marginTop: 8 }}>
			<Body>Run on board</Body>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			<Field
				label="Sketch dir on the Pi"
				value={dir}
				onChangeText={setDir}
				placeholder="/home/gpio/blink"
			/>
			<TextButton
				label="Start"
				disabled={busy || !token || !dir.trim()}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						await startRun(token, { uuid, dir: dir.trim() });
						setStatus(await loadRun(token, uuid));
					});
				}}
			/>
			<TextButton
				label="Stop"
				disabled={busy || !token}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						await stopRun(token, uuid);
						setStatus(await loadRun(token, uuid));
					});
				}}
			/>
			<TextButton
				label="Start over Bluetooth"
				disabled={busy || !token || !dir.trim()}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						const envelope = await signRun(token, {
							uuid,
							dir: dir.trim(),
							sign: true,
						});
						const paired = await openPairedBoard(uuid, { token });
						try {
							await sendEnvelope(paired.session.device, envelope, paired.loss);
						} finally {
							await paired.session.close();
						}
					});
				}}
			/>
			<TextButton
				label="Stop over Bluetooth"
				disabled={busy || !token}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						const envelope = await signRun(token, {
							uuid,
							stop: true,
							sign: true,
						});
						const paired = await openPairedBoard(uuid, { token });
						try {
							await sendEnvelope(paired.session.device, envelope, paired.loss);
						} finally {
							await paired.session.close();
						}
					});
				}}
			/>
			{error ? <ErrorText>{error}</ErrorText> : null}
			<Muted>
				{status?.running
					? "Running on companion GPIO…"
					: status?.last
						? status.last.ok
							? "Last run exited 0"
							: "Last run failed"
						: "C sketch on the Pi, then run on this header."}
			</Muted>
			{log ? <Muted>{log}</Muted> : null}
		</View>
	);
}
