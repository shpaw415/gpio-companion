import { POST as signWifi } from "@api/wifi";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { type FormEvent, useState } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";
import {
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";

type Status = "idle" | "connecting" | "sending" | "success" | "error";

export default function WifiBleForm() {
	const session = useAuthSession();
	const supported = bluetoothSupported();
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [uuid, setUuid] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [message, setMessage] = useState("");

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
		if (!supported) {
			setStatus("error");
			setMessage(
				"Web Bluetooth needs Chrome or Edge on desktop or Android. Safari on iOS cannot use Bluetooth or USB from the browser — use Ethernet, the Pi TTY, or Chrome on another device.",
			);
			return;
		}
		setStatus("connecting");
		setMessage("");
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
							This browser cannot use Web Bluetooth. Use Chrome or Edge
							(desktop/Android). Safari on iOS has no Bluetooth or WebUSB — plug
							Ethernet or run first-setup on the Pi TTY.
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
						placeholder="read from the Pi over Bluetooth"
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
								: "Connect over Bluetooth"}
					</Button>
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
