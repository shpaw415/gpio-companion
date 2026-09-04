import { useState } from "react";
import { Text } from "react-native";
import { loadDeviceInfo, signDeviceInfo } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import {
	createBoardLoss,
	openBoardSession,
	readInfo,
	scanBoard,
	sendEnvelope,
} from "../lib/ble.ts";
import { useColors } from "../lib/color-mode.tsx";
import { flattenDeviceInfo } from "../lib/device-info.ts";
import { ErrorText, TextButton } from "./ui.tsx";

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
						const loss = createBoardLoss();
						const board = await scanBoard();
						const session = await openBoardSession(board, (why) =>
							loss.lose(why),
						);
						try {
							const bleInfo = await readInfo(session.device);
							if (bleInfo.uuid && bleInfo.uuid !== uuid) {
								throw new Error("this board is not the selected paired device");
							}
							const envelope = await signDeviceInfo(token, uuid);
							return parseInfoPayload(
								await sendEnvelope(session.device, envelope, loss),
							);
						} finally {
							await session.close();
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
