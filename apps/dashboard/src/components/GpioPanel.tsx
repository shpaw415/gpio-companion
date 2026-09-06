import { POST as signGpio } from "@api/device/gpio";
import { GET as loadGpio, PUT as putGpio } from "@api/gpio";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	envelopeToPasteText,
	type GpioPinState,
	type GpioSnapshot,
} from "gpio-companion";
import { useCallback, useEffect, useState } from "react";
import { unwrapAction } from "../lib/action.ts";
import {
	bluetoothChooserCancelled,
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";
import CopyBlock from "./CopyBlock.tsx";

export default function GpioPanel({
	uuid,
	poll = false,
	onSnapshot,
}: {
	uuid: string;
	poll?: boolean;
	onSnapshot?: (snapshot: GpioSnapshot | null) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [snapshot, setSnapshot] = useState<GpioSnapshot | null>(null);
	const [pasteText, setPasteText] = useState("");
	const supported = bluetoothSupported();

	const applySnapshot = useCallback(
		(next: GpioSnapshot | null) => {
			setSnapshot(next);
			onSnapshot?.(next);
		},
		[onSnapshot],
	);

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

	useEffect(() => {
		if (!poll || !uuid) {
			return;
		}
		let cancelled = false;
		async function tick() {
			try {
				const next = unwrapAction(await loadGpio(uuid));
				if (!cancelled) {
					applySnapshot(next);
					setError("");
				}
			} catch (caught) {
				if (!cancelled) {
					setError(caught instanceof Error ? caught.message : "request failed");
				}
			}
		}
		void tick();
		const timer = setInterval(() => void tick(), 1000);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [poll, uuid, applySnapshot]);

	const gpioPins = snapshot?.pins.filter((pin) => pin.type === "gpio") ?? [];

	return (
		<Stack spacing={1}>
			<Typography variant="subtitle1">GPIO</Typography>
			<Stack direction="row" spacing={1} className="flex-wrap">
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							applySnapshot(unwrapAction(await loadGpio(uuid)));
						});
					}}
				>
					{busy ? "Loading…" : "Load GPIO"}
				</Button>
				<Button
					type="button"
					variant="outlined"
					size="small"
					disabled={busy || !uuid}
					onClick={() => {
						start(async () => {
							applySnapshot(
								await runGpioEnvelope(
									uuid,
									unwrapAction(await signGpio({ uuid })),
									supported,
									(text) => setPasteText(text),
								),
							);
						});
					}}
				>
					{supported ? "Load over Bluetooth" : "Sign GPIO for Bluetooth"}
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
			{snapshot ? (
				<Typography color="secondary" variant="body2">
					{snapshot.hardware} · click a pin to toggle output
				</Typography>
			) : null}
			<Stack direction="row" spacing={1} className="flex-wrap">
				{gpioPins.map((pin) => (
					<Button
						key={pin.physical}
						type="button"
						size="small"
						variant={pin.value === 1 ? "contained" : "outlined"}
						disabled={busy || !uuid || pin.reserved || pin.unresolved}
						onClick={() => {
							start(async () => {
								const nextValue = pin.value === 1 ? 0 : 1;
								applySnapshot(
									unwrapAction(
										await putGpio({
											uuid,
											physical: pin.physical,
											dir: "out",
											value: nextValue,
										}),
									),
								);
							});
						}}
					>
						{pinLabel(pin)}
					</Button>
				))}
			</Stack>
		</Stack>
	);
}

function pinLabel(pin: GpioPinState): string {
	if (pin.reserved) {
		return `${pin.physical} reserved`;
	}
	if (pin.unresolved) {
		return `${pin.physical} ?`;
	}
	const value = pin.value === undefined ? "-" : String(pin.value);
	return `${pin.physical} ${value}`;
}

async function runGpioEnvelope(
	uuid: string,
	envelope: unknown,
	supported: boolean,
	onPaste: (text: string) => void,
): Promise<GpioSnapshot | null> {
	if (!supported) {
		const text = envelopeToPasteText(
			envelope as Parameters<typeof envelopeToPasteText>[0],
		);
		onPaste(text);
		await navigator.clipboard.writeText(text).catch(() => undefined);
		return null;
	}
	const ble = await connectGpioCompanionBle();
	try {
		if (ble.info.uuid && ble.info.uuid !== uuid) {
			throw new Error("this board is not the selected paired device");
		}
		return parseGpioPayload(await ble.sendEnvelope(envelope as never));
	} finally {
		ble.disconnect();
	}
}

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
