import { POST as signDeviceInfo } from "@api/device/info";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	envelopeToPasteText,
	flattenDeviceInfo,
	INFO_PATH,
} from "gpio-companion";
import { useState } from "react";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey.ts";
import { type ActionResult, unwrapAction } from "../lib/action.ts";
import { withOfflineSign } from "../lib/offline-ble.ts";
import {
	bluetoothChooserCancelled,
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";
import CopyBlock from "./CopyBlock.tsx";

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

export default function DeviceCompanionInfo({
	uuid,
	loadInfo,
}: {
	uuid: string;
	loadInfo: (uuid: string) => Promise<ActionResult<{ info: unknown }>>;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [info, setInfo] = useState<unknown>(null);
	const [pasteText, setPasteText] = useState("");
	const supported = bluetoothSupported();
	const offline = useOfflineBleKey(uuid);
	const rows = info ? flattenDeviceInfo(info) : [];

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		setPasteText("");
		void task()
			.catch((caught) => {
				if (bluetoothChooserCancelled(caught)) {
					return;
				}
				setError(caught instanceof Error ? caught.message : "request failed");
				setInfo(null);
			})
			.finally(() => setBusy(false));
	}

	return (
		<Stack spacing={1}>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} className="flex-wrap">
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							setInfo(unwrapAction(await loadInfo(uuid)).info);
						});
					}}
				>
					{busy ? "Loading…" : "Load companion info"}
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							const envelope = await withOfflineSign(
								uuid,
								async () => unwrapAction(await signDeviceInfo(uuid)),
								{ method: "GET", path: INFO_PATH },
							);
							if (!supported) {
								const text = envelopeToPasteText(envelope);
								setPasteText(text);
								await navigator.clipboard
									.writeText(text)
									.catch(() => undefined);
								return;
							}
							const ble = await connectGpioCompanionBle(uuid);
							try {
								if (ble.info.uuid && ble.info.uuid !== uuid) {
									throw new Error(
										"this board is not the selected paired device",
									);
								}
								setInfo(parseInfoPayload(await ble.sendEnvelope(envelope)));
							} finally {
								ble.disconnect();
							}
						});
					}}
				>
					{supported ? "Load over Bluetooth" : "Sign for Bluetooth"}
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{supported ? null : pasteText ? (
				<>
					<CopyBlock label="Bluetooth name" value={BLE_DEVICE_NAME} />
					<CopyBlock label="Write characteristic" value={BLE_CMD_UUID} />
					<CopyBlock label="Signed Bluetooth command" value={pasteText} />
				</>
			) : null}
			{rows.map((row) => (
				<Typography key={row.key} variant="body2" className="break-all">
					{row.key}: {row.value}
				</Typography>
			))}
			{info ? (
				<CopyBlock label="JSON" value={JSON.stringify(info, null, 2)} />
			) : null}
		</Stack>
	);
}
