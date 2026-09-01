import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import {
	authSession,
	type Device,
	listDevices,
	type Session,
	unpairDevice,
} from "../api";
import DebugLog from "./DebugLog";

export default function Devices({
	onPair,
	onWifi,
	onSignOut,
}: {
	onPair: () => void;
	onWifi: () => void;
	onSignOut: () => void;
}) {
	const [devices, setDevices] = useState<Device[]>([]);
	const [session, setSession] = useState<Session | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		void authSession()
			.then((next) => {
				setSession(next);
				console.info("gpio-companion-desktop session", next);
			})
			.catch((caught) => {
				const message =
					caught instanceof Error ? caught.message : "profile load failed";
				console.error("gpio-companion-desktop session", message);
				setError(message);
			});
		void listDevices()
			.then((result) => setDevices(result.devices))
			.catch((caught) => {
				const message =
					caught instanceof Error ? caught.message : "load failed";
				console.error("gpio-companion-desktop devices", message);
				setError((current) => current || message);
			});
	}, []);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Devices
			</Typography>
			{session?.name || session?.email ? (
				<Typography color="secondary">
					{session.name || session.email}
				</Typography>
			) : null}
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
			{devices.length === 0 ? (
				<Typography color="secondary">
					No boards yet. Pair one nearby.
				</Typography>
			) : (
				devices.map((device) => (
					<Paper key={device.uuid} sx={{ p: 2 }} elevation={1}>
						<Typography variant="subtitle1">
							{device.label?.trim() || device.login || device.uuid}
						</Typography>
						<Typography color="secondary">{device.uuid}</Typography>
						<Button
							color="error"
							variant="text"
							onClick={() => {
								if (!window.confirm("Remove this board from your account?")) {
									return;
								}
								void unpairDevice(device.uuid).then(() =>
									setDevices((current) =>
										current.filter((item) => item.uuid !== device.uuid),
									),
								);
							}}
						>
							Unpair
						</Button>
					</Paper>
				))
			)}
			<Button variant="contained" onClick={onPair}>
				Pair over Bluetooth
			</Button>
			<Button variant="text" onClick={onWifi}>
				Set WiFi
			</Button>
			<Button variant="text" color="secondary" onClick={onSignOut}>
				Sign out
			</Button>
		</Stack>
	);
}
