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
import { type FormEvent, useState } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";
import {
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";

type Status = "idle" | "connecting" | "sending" | "success" | "error";

const LIGHTBLUE = "https://apps.apple.com/app/lightblue/id557428110";
const NRF_CONNECT =
	"https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564";

export default function WifiBleForm() {
	const session = useAuthSession();
	const supported = bluetoothSupported();
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [uuid, setUuid] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [message, setMessage] = useState("");
	const [pasteText, setPasteText] = useState("");

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
		if (!supported) {
			setStatus("sending");
			try {
				const envelope = await signWifi({ uuid, ssid, psk });
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
			const boardUuid = ble.info.uuid || uuid;
			setUuid(boardUuid);
			setStatus("sending");
			const envelope = await signWifi({
				uuid: boardUuid,
				ssid,
				psk,
			});
			const raw = await ble.sendEnvelope(envelope);
			ble.disconnect();
			let ok = true;
			try {
				const parsed = JSON.parse(raw) as { error?: string; ssid?: string };
				if (parsed.error) {
					ok = false;
					setMessage(parsed.error);
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

	return (
		<Paper className="max-w-xl p-6" elevation={1}>
			<form onSubmit={onSubmit}>
				<Stack spacing={2}>
					{supported ? null : (
						<Alert severity="error">
							Safari on iOS cannot talk to the Pi from this page. Sign the WiFi
							command here, then paste it as text in LightBlue or nRF Connect. A
							native gpio-companion app will replace this later.
						</Alert>
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
					<TextField
						label="Pairing UUID"
						placeholder={
							supported
								? "read from the Pi over Bluetooth"
								: "printed at Pi first-setup"
						}
						value={uuid}
						onChange={(event) => setUuid(event.target.value)}
						className="w-full"
					/>
					<Button
						type="submit"
						variant="contained"
						disabled={status === "connecting" || status === "sending"}
					>
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
								2. Connect to {BLE_DEVICE_NAME}, open the write characteristic{" "}
								{BLE_CMD_UUID}, paste the signed JSON as UTF-8 text, send.
							</Typography>
						</>
					)}
					{pasteText ? (
						<textarea
							readOnly
							className="w-full min-h-32 p-2 font-mono text-xs"
							value={pasteText}
						/>
					) : null}
					{pasteText ? (
						<Button
							type="button"
							variant="outlined"
							onClick={() => {
								void navigator.clipboard.writeText(pasteText);
							}}
						>
							Copy again
						</Button>
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
