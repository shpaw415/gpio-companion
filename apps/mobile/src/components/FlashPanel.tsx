import { useCallback, useState } from "react";
import { View } from "react-native";
import {
	type FlashStatus,
	loadFlash,
	loadFlashPorts,
	signFlash,
	startFlash,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import { Body, ErrorText, Field, Muted, TextButton } from "./ui.tsx";

export default function FlashPanel({ uuid }: { uuid: string }) {
	const auth = useAuth();
	const token = auth.token;
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<FlashStatus | null>(null);
	const [fqbn, setFqbn] = useState("arduino:avr:uno");
	const [dir, setDir] = useState("");
	const [port, setPort] = useState("");
	const offline = useOfflineBleKey(uuid);
	const onFlash = useCallback((next: FlashStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, token, { onFlash });

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	return (
		<View style={{ gap: 8, marginTop: 8 }}>
			<Body>Arduino flash</Body>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			<TextButton
				label={busy ? "Loading…" : "Load ports"}
				disabled={busy || !uuid || !token}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						setStatus(await loadFlash(token, uuid));
						const listed = await loadFlashPorts(token, uuid);
						const first = listed.ports[0];
						if (first?.fqbn) {
							setFqbn(first.fqbn);
						}
						if (first?.address) {
							setPort(first.address);
						}
					});
				}}
			/>
			<Field label="FQBN" value={fqbn} onChangeText={setFqbn} />
			<Field
				label="Sketch dir on the Pi"
				value={dir}
				onChangeText={setDir}
				placeholder="/home/gpio/blink"
			/>
			<Field label="Port (optional)" value={port} onChangeText={setPort} />
			<TextButton
				label="Flash"
				disabled={busy || !token || !fqbn.trim() || !dir.trim()}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						await startFlash(token, {
							uuid,
							fqbn: fqbn.trim(),
							dir: dir.trim(),
							port: port.trim() || undefined,
						});
						setStatus(await loadFlash(token, uuid));
					});
				}}
			/>
			<TextButton
				label="Flash over Bluetooth"
				disabled={busy || !token || !fqbn.trim() || !dir.trim()}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						const envelope = await signFlash(token, {
							uuid,
							fqbn: fqbn.trim(),
							dir: dir.trim(),
							port: port.trim() || undefined,
							sign: true,
						});
						const paired = await openPairedBoard(uuid, { token });
						try {
							await sendEnvelope(
								paired.session.device,
								envelope,
								paired.loss,
							);
						} finally {
							await paired.session.close();
						}
					});
				}}
			/>
			{error ? <ErrorText>{error}</ErrorText> : null}
			<Muted>
				{status?.running
					? "Flashing…"
					: status?.last
						? status.last.ok
							? `Last flash ok · ${status.last.fqbn}`
							: `Last flash failed · ${status.last.fqbn}`
						: "C sketch on the Pi, then flash."}
			</Muted>
		</View>
	);
}
