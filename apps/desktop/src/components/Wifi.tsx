import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { bleWifi, type Device, listDevices, onBleStatus } from "../api";
import DebugLog from "./DebugLog";

export default function Wifi({ onBack }: { onBack: () => void }) {
	const [devices, setDevices] = useState<Device[]>([]);
	const [uuid, setUuid] = useState("");
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void listDevices().then((result) => {
			setDevices(result.devices);
			setUuid(result.devices.at(-1)?.uuid ?? "");
		});
		let unlisten: (() => void) | undefined;
		void onBleStatus(setStatus).then((fn) => {
			unlisten = fn;
		});
		return () => unlisten?.();
	}, []);

	async function send() {
		setBusy(true);
		setError("");
		try {
			const raw = await bleWifi({ uuid, ssid, psk });
			setStatus(raw || "sent");
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "wifi failed";
			console.error("gpio-companion-desktop wifi", message);
			setError(message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				WiFi over Bluetooth
			</Typography>
			<Select
				name="uuid"
				label="Paired device"
				value={uuid}
				onSelect={(next) => setUuid(next)}
				sx={{ width: "100%" }}
				disabled={devices.length === 0}
			>
				{devices.map((device) => (
					<option key={device.uuid} value={device.uuid}>
						{device.label?.trim()
							? `${device.label.trim()} — ${device.uuid}`
							: device.uuid}
					</option>
				))}
			</Select>
			<TextField
				label="SSID"
				value={ssid}
				onChange={(event) => setSsid(event.target.value)}
			/>
			<TextField
				label="Password"
				type="password"
				value={psk}
				onChange={(event) => setPsk(event.target.value)}
			/>
			{status ? <Typography>{status}</Typography> : null}
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
			<Button variant="contained" disabled={busy} onClick={() => void send()}>
				Send to board
			</Button>
			<Button variant="text" onClick={onBack}>
				Back
			</Button>
		</Stack>
	);
}
