import { POST as signVerify } from "@api/device/verify";
import { GET as loadVerify, POST as startVerify } from "@api/verify";
import { POST as stopVerify } from "@api/verify/stop";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	type CircuitVerifyItem,
	type CircuitVerifyState,
	circuitVerifyLabel,
	envelopeToPasteText,
	parseVerifyPut,
	VERIFY_PATH,
} from "gpio-companion";
import { useCallback, useEffect, useState } from "react";
import { useOfflineBleKey } from "../hooks/useOfflineBleKey.ts";
import { unwrapAction } from "../lib/action.ts";
import { withOfflineSign } from "../lib/offline-ble.ts";
import {
	bluetoothChooserCancelled,
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";
import CopyBlock from "./CopyBlock.tsx";

export default function VerifyPanel({
	uuid,
	project,
	onResults,
}: {
	uuid: string;
	project?: string;
	onResults?: (results: CircuitVerifyItem[]) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<CircuitVerifyState | null>(null);
	const [pasteText, setPasteText] = useState("");
	const supported = bluetoothSupported();
	const offline = useOfflineBleKey(uuid);
	const results = status?.results.length
		? status.results
		: (status?.last?.results ?? []);

	const applyStatus = useCallback(
		(next: CircuitVerifyState) => {
			setStatus(next);
			onResults?.(
				next.results.length ? next.results : (next.last?.results ?? []),
			);
		},
		[onResults],
	);

	useEffect(() => {
		if (!uuid || !status?.running) {
			return;
		}
		const timer = setInterval(() => {
			void loadVerify(uuid)
				.then((result) => applyStatus(unwrapAction(result)))
				.catch(() => undefined);
		}, 400);
		return () => clearInterval(timer);
	}, [uuid, status?.running, applyStatus]);

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
			})
			.finally(() => setBusy(false));
	}

	const canStart = Boolean(project);

	return (
		<Stack spacing={1}>
			<Typography variant="subtitle1">Verify circuit</Typography>
			<Typography variant="body2" color="secondary">
				Pulse declared jumpers on the board. LED on/off needs a second GPIO or
				ADC (not on this header).
			</Typography>
			{uuid ? (
				<Typography variant="body2" color="secondary">
					{offline.label}
				</Typography>
			) : null}
			{!project ? (
				<Typography color="secondary" variant="body2">
					Select a project with breadboard/diagram.json.
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} className="flex-wrap">
				<Button
					type="button"
					variant="contained"
					size="small"
					disabled={busy || !uuid || !canStart}
					onClick={() => {
						start(async () => {
							unwrapAction(
								await startVerify({ uuid, repo: project?.trim() ?? "" }),
							);
							applyStatus(unwrapAction(await loadVerify(uuid)));
						});
					}}
				>
					Verify
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							unwrapAction(await stopVerify(uuid));
							applyStatus(unwrapAction(await loadVerify(uuid)));
						});
					}}
				>
					Stop
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid || !canStart}
					onClick={() => {
						start(async () => {
							await runEnvelope(
								uuid,
								await withOfflineSign(
									uuid,
									async () =>
										unwrapAction(
											await signVerify({
												uuid,
												repo: project?.trim() ?? "",
											}),
										),
									{
										method: "POST",
										path: VERIFY_PATH,
										body: JSON.stringify(
											parseVerifyPut({ repo: project?.trim() ?? "" }),
										),
									},
								),
								supported,
								(text) => setPasteText(text),
							);
							applyStatus({
								running: true,
								results: status?.results ?? [],
								last: status?.last ?? null,
							});
						});
					}}
				>
					{supported ? "Verify over Bluetooth" : "Sign verify for Bluetooth"}
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
			<Typography color="secondary" variant="body2">
				{status?.running
					? "Probing jumpers…"
					: status?.last
						? status.last.ok
							? "Last verify had no fails"
							: "Last verify found a problem"
						: "Uses breadboard/diagram.json on the board."}
			</Typography>
			{results.length ? (
				<Stack direction="row" spacing={1} className="flex-wrap">
					{results.map((item) => (
						<Chip
							key={item.id}
							label={`${circuitVerifyLabel(item.status)} · ${item.detail}`}
							size="small"
							variant="outlined"
							color={
								item.status === "pass"
									? "success"
									: item.status === "fail" || item.status === "unsafe"
										? "error"
										: item.status === "needs-press"
											? "warning"
											: "secondary"
							}
						/>
					))}
				</Stack>
			) : null}
		</Stack>
	);
}

async function runEnvelope(
	uuid: string,
	envelope: unknown,
	supported: boolean,
	onPaste: (text: string) => void,
): Promise<unknown> {
	if (!supported) {
		const text = envelopeToPasteText(
			envelope as Parameters<typeof envelopeToPasteText>[0],
		);
		onPaste(text);
		await navigator.clipboard.writeText(text).catch(() => undefined);
		return null;
	}
	const ble = await connectGpioCompanionBle(uuid);
	try {
		if (ble.info.uuid && ble.info.uuid !== uuid) {
			throw new Error("this board is not the selected paired device");
		}
		return parsePayload(await ble.sendEnvelope(envelope as never));
	} finally {
		ble.disconnect();
	}
}

function parsePayload(raw: string): unknown {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("board did not return verify");
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
