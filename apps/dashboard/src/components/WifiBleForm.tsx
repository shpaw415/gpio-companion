import { GET as getPairing } from "@api/pair";
import { POST as signWifi } from "@api/wifi";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	envelopeToPasteText,
} from "gpio-companion";
import { type FormEvent, useEffect, useState } from "react";
import { useActionError } from "../hooks/useActionError.tsx";
import { useAuthSession } from "../hooks/useAuth.ts";
import { unwrapAction } from "../lib/action.ts";
import type { StoredPairing } from "../lib/pairing-store.ts";
import {
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";
import CopyBlock from "./CopyBlock.tsx";
import DeviceSelect from "./DeviceSelect.tsx";

type Status = "idle" | "connecting" | "sending" | "success" | "error";

const LIGHTBLUE = "https://apps.apple.com/app/lightblue/id557428110";
const NRF_CONNECT =
	"https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564";

export default function WifiBleForm() {
	const session = useAuthSession();
	const { run } = useActionError();
	const supported = bluetoothSupported();
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [uuid, setUuid] = useState("");
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [status, setStatus] = useState<Status>("idle");
	const [message, setMessage] = useState("");
	const [pasteText, setPasteText] = useState("");

	useEffect(() => {
		if (!session.data?.id) {
			setDevices([]);
			setUuid("");
			return;
		}
		void run(getPairing()).then((result) => {
			const next = result?.devices ?? [];
			setDevices(next);
			setUuid((current) => {
				if (current && next.some((device) => device.uuid === current)) {
					return current;
				}
				return next[0]?.uuid ?? "";
			});
		});
	}, [session.data?.id, run]);

	if (!session.data?.id && !session.data?.email) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					Sign in
				</Button>{" "}
				to configure WiFi over Bluetooth.
			</Typography>
		);
	}

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setMessage("");
		if (!uuid) {
			setStatus("error");
			setMessage("pair a device first");
			return;
		}
		if (!supported) {
			setStatus("sending");
			try {
				const envelope = unwrapAction(await signWifi({ uuid, ssid, psk }));
				const text = envelopeToPasteText(envelope);
				setPasteText(text);
				await navigator.clipboard.writeText(text).catch(() => undefined);
				setStatus("success");
				setMessage(
					"signed command copied — paste it in LightBlue or nRF Connect",
				);
				setPsk("");
			} catch (error) {
				setStatus("error");
				setMessage(error instanceof Error ? error.message : "sign failed");
			}
			return;
		}
		setStatus("connecting");
		try {
			const ble = await connectGpioCompanionBle();
			if (ble.info.uuid && ble.info.uuid !== uuid) {
				ble.disconnect();
				throw new Error("this board is not the selected paired device");
			}
			setStatus("sending");
			const envelope = unwrapAction(
				await signWifi({
					uuid,
					ssid,
					psk,
				}),
			);
			const raw = await ble.sendEnvelope(envelope);
			ble.disconnect();
			let ok = true;
			try {
				const parsed = JSON.parse(raw) as {
					error?: string;
					ssid?: string;
					connected?: boolean;
				};
				if (parsed.error || parsed.connected === false) {
					ok = false;
					setMessage(parsed.error || "wifi connect failed");
				} else {
					setMessage(`connected to ${parsed.ssid || ssid}`);
				}
			} catch {
				setMessage(raw);
			}
			setStatus(ok ? "success" : "error");
			setPsk("");
		} catch (error) {
			setStatus("error");
			setMessage(error instanceof Error ? error.message : "wifi failed");
		}
	}

	const busy = status === "connecting" || status === "sending";
	const canSubmit = Boolean(uuid && ssid && psk) && !busy;

	return (
		<Paper className="w-full max-w-xl p-4 min-[900px]:p-6" elevation={1}>
			<form onSubmit={onSubmit}>
				<Stack spacing={2}>
					{supported ? null : (
						<Alert severity="error">
							Safari on iOS cannot talk to the Pi from this page. Sign the WiFi
							command here, then paste it as text in LightBlue or nRF Connect. A
							native gpio-companion app will replace this later.
						</Alert>
					)}
					{devices.length === 0 ? (
						<Alert severity="info">
							<Button href="/devices/pair" variant="text">
								Pair a board
							</Button>{" "}
							before signing a WiFi command.
						</Alert>
					) : (
						<DeviceSelect
							devices={devices}
							value={uuid}
							onChange={setUuid}
							disabled={busy}
						/>
					)}
					<TextField
						label="SSID"
						value={ssid}
						onChange={(event) => setSsid(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="WiFi password"
						type="password"
						autoComplete="off"
						value={psk}
						onChange={(event) => setPsk(event.target.value)}
						className="w-full"
					/>
					<Button type="submit" variant="contained" disabled={!canSubmit}>
						{status === "connecting"
							? "Connecting…"
							: status === "sending"
								? "Signing…"
								: supported
									? "Connect over Bluetooth"
									: "Sign and copy"}
					</Button>
					{supported ? null : (
						<>
							<Typography variant="body2" color="secondary">
								1. Install{" "}
								<Button href={LIGHTBLUE} variant="text">
									LightBlue
								</Button>{" "}
								or{" "}
								<Button href={NRF_CONNECT} variant="text">
									nRF Connect
								</Button>
								.
							</Typography>
							<Typography variant="body2" color="secondary">
								2. Connect to the board, open the write characteristic, paste
								the signed JSON as UTF-8 text, send.
							</Typography>
							<CopyBlock label="Bluetooth name" value={BLE_DEVICE_NAME} />
							<CopyBlock label="Write characteristic" value={BLE_CMD_UUID} />
						</>
					)}
					{pasteText ? (
						<CopyBlock label="Signed Bluetooth command" value={pasteText} />
					) : null}
					{message ? (
						<Alert severity={status === "error" ? "error" : "success"}>
							{message}
						</Alert>
					) : null}
				</Stack>
			</form>
		</Paper>
	);
}
