import { useState } from "react";
import { Text } from "react-native";
import { loadDeviceInfo, signDeviceInfo } from "../lib/api.ts";
import { useOfflineBleKey } from "../lib/use-offline-ble-key.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { useColors } from "../lib/color-mode.tsx";
import { flattenDeviceInfo } from "../lib/device-info.ts";
import { ErrorText, Muted, TextButton } from "./ui.tsx";

function parseInfoPayload(raw: string): unknown {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("board did not return companion info");
	}
	if (
		parsed &&
		typeof parsed === "object" &&
		"error" in parsed &&
		typeof (parsed as { error?: unknown }).error === "string"
	) {
		throw new Error((parsed as { error: string }).error);
	}
	return parsed;
}

export default function CompanionInfo({ uuid }: { uuid: string }) {
	const auth = useAuth();
	const colors = useColors();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [info, setInfo] = useState<unknown>(null);
	const offline = useOfflineBleKey(uuid);
	const rows = info ? flattenDeviceInfo(info) : [];

	function start(task: () => Promise<unknown>) {
		setBusy(true);
		setError("");
		void task()
			.then((result) => {
				setInfo(result);
			})
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
				setInfo(null);
			})
			.finally(() => setBusy(false));
	}

	return (
		<>
			{uuid ? <Muted>{offline.label}</Muted> : null}
			<TextButton
				label={busy ? "Loading…" : "Load companion info"}
				disabled={busy || !uuid || !auth.token}
				onPress={() => {
					if (!auth.token) {
						return;
					}
					start(
						async () => (await loadDeviceInfo(auth.token as string, uuid)).info,
					);
				}}
			/>
			<TextButton
				label="Load over Bluetooth"
				disabled={busy || !uuid || !auth.token}
				onPress={() => {
					if (!auth.token) {
						return;
					}
					const token = auth.token;
					start(async () => {
						const paired = await openPairedBoard(uuid, { token });
						try {
							const envelope = await signDeviceInfo(token, uuid);
							return parseInfoPayload(
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
			<ErrorText>{error}</ErrorText>
			{rows.map((row) => (
				<Text
					key={row.key}
					selectable
					style={{ color: colors.muted, fontSize: 12 }}
				>
					{row.key}: {row.value}
				</Text>
			))}
		</>
	);
}
