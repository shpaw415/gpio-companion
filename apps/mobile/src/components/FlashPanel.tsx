import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
	type BoardSketch,
	type FlashStatus,
	loadFlash,
	loadFlashPorts,
	loadFlashSketches,
	signFlash,
	startFlash,
	startUsbConsole,
	stopUsbConsole,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import { useColors } from "../lib/color-mode.tsx";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { useConsoleTunnel } from "../lib/use-console-tunnel.ts";
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import { Body, ErrorText, Field, Muted, TextButton } from "./ui.tsx";

export default function FlashPanel({
	uuid,
	project,
}: {
	uuid: string;
	project?: string;
}) {
	const auth = useAuth();
	const token = auth.token;
	const colors = useColors();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<FlashStatus | null>(null);
	const [fqbn, setFqbn] = useState("arduino:avr:uno");
	const [dir, setDir] = useState("");
	const [port, setPort] = useState("");
	const [sketches, setSketches] = useState<BoardSketch[]>([]);
	const [legacy, setLegacy] = useState(false);
	const offline = useOfflineBleKey(uuid);
	const listed = useMemo(
		() => sketches.filter((item) => !project || item.project === project),
		[sketches, project],
	);

	useEffect(() => {
		if (!uuid || !token) {
			setSketches([]);
			setLegacy(false);
			return;
		}
		let cancelled = false;
		loadFlashSketches(token, uuid)
			.then((result) => {
				if (cancelled) {
					return;
				}
				setSketches(result.sketches);
				setLegacy(false);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setSketches([]);
				setLegacy(true);
			});
		return () => {
			cancelled = true;
		};
	}, [uuid, token]);

	useEffect(() => {
		if (legacy) {
			return;
		}
		if (!listed.some((item) => item.dir === dir)) {
			setDir(listed[0]?.dir ?? "");
		}
	}, [listed, dir, legacy]);
	const onFlash = useCallback((next: FlashStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, token, { onFlash });
	const serial = useConsoleTunnel(uuid, token, setError);
	const canFlash =
		Boolean(fqbn.trim()) && Boolean(dir.trim()) && (legacy || Boolean(project));

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
			{legacy ? (
				<Field
					label="Sketch dir on the Pi"
					value={dir}
					onChangeText={setDir}
					placeholder="/home/gpio/blink"
				/>
			) : !project ? (
				<Muted>Select a project to see firmware sketches on this board.</Muted>
			) : listed.length === 0 ? (
				<Muted>
					No USB sketches on this board for this project. Ask Code to write them
					under firmware/.
				</Muted>
			) : (
				listed.map((item) => (
					<Pressable
						key={item.dir}
						onPress={() => setDir(item.dir)}
						style={{
							borderWidth: 1,
							borderColor: dir === item.dir ? colors.primary : colors.border,
							borderRadius: 8,
							paddingHorizontal: 10,
							paddingVertical: 8,
						}}
					>
						<Text
							style={{
								color: dir === item.dir ? colors.primary : colors.text,
							}}
						>
							{item.name}
						</Text>
					</Pressable>
				))
			)}
			<Field label="Port (optional)" value={port} onChangeText={setPort} />
			<TextButton
				label="Open serial"
				disabled={busy || !token || !port.trim() || Boolean(status?.running)}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						await startUsbConsole(token, { uuid, port: port.trim() });
					});
				}}
			/>
			<TextButton
				label="Close serial"
				disabled={busy || !token}
				onPress={() => {
					if (!token) {
						return;
					}
					start(async () => {
						await stopUsbConsole(token, uuid);
					});
				}}
			/>
			<TextButton
				label="Flash"
				disabled={busy || !token || !canFlash}
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
				disabled={busy || !token || !canFlash}
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
					? "Flashing…"
					: status?.last
						? status.last.ok
							? `Last flash ok · ${status.last.fqbn}`
							: `Last flash failed · ${status.last.fqbn}`
						: "C sketch on the Pi, then flash."}
			</Muted>
			<Muted>Serial {serial.status}</Muted>
			{serial.snapshot.usb.log ? (
				<Muted>{serial.snapshot.usb.log}</Muted>
			) : null}
		</View>
	);
}
