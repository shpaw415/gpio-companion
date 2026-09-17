import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
	type BoardSketch,
	loadRun,
	loadRunSketches,
	type RunStatus,
	signRun,
	startRun,
	stopRun,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import { useColors } from "../lib/color-mode.tsx";
import { translateError, useT } from "../lib/locale.tsx";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { useConsoleTunnel } from "../lib/use-console-tunnel.ts";
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import LiveConsole from "./LiveConsole.tsx";
import { Body, ErrorText, Field, Muted, TextButton } from "./ui.tsx";

export default function RunPanel({
	uuid,
	project,
}: {
	uuid: string;
	project?: string;
}) {
	const auth = useAuth();
	const t = useT();
	const token = auth.token;
	const colors = useColors();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<RunStatus | null>(null);
	const [dir, setDir] = useState("");
	const [sketches, setSketches] = useState<BoardSketch[]>([]);
	const [legacy, setLegacy] = useState(false);
	const offline = useOfflineBleKey(uuid);
	const listed = useMemo(
		() => sketches.filter((item) => !project || item.project === project),
		[sketches, project],
	);
	const onRun = useCallback((next: RunStatus) => {
		setStatus(next);
	}, []);
	useDeviceHub(uuid, token, { onRun });
	const serial = useConsoleTunnel(uuid, token, setError);

	useEffect(() => {
		if (!uuid || !token) {
			setSketches([]);
			setLegacy(false);
			return;
		}
		let cancelled = false;
		loadRunSketches(token, uuid)
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

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	const log =
		serial.snapshot.host.log || status?.log || status?.last?.log || "";
	const canStart = Boolean(dir.trim()) && (legacy || Boolean(project));

	return (
		<View style={{ gap: 8, marginTop: 8 }}>
			<Body>{t("run.title")}</Body>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			{legacy ? (
				<Field
					label={t("flash.sketchDir")}
					value={dir}
					onChangeText={setDir}
					placeholder="/home/gpio/blink"
				/>
			) : !project ? (
				<Muted>{t("run.selectProject")}</Muted>
			) : listed.length === 0 ? (
				<Muted>{t("run.noSketches")}</Muted>
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
			<TextButton
				label={t("run.start")}
				disabled={busy || !token || !canStart}
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
				label={t("run.stop")}
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
				label={t("run.startBle")}
				disabled={busy || !token || !canStart}
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
				label={t("run.stopBle")}
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
			{error ? <ErrorText>{translateError(t, error)}</ErrorText> : null}
			<Muted>
				{status?.running
					? t("run.running")
					: status?.last
						? status.last.ok
							? t("run.lastOk")
							: t("run.lastFailed")
						: t("run.thenRun")}
			</Muted>
			<Muted>{t("run.serialStatus", { status: serial.status })}</Muted>
			<LiveConsole label={t("run.serialHost")} value={log} />
		</View>
	);
}
