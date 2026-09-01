import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { type Device, listDevices, unpairDevice } from "../api";

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
	const [error, setError] = useState("");

	useEffect(() => {
		void listDevices()
			.then((result) => setDevices(result.devices))
			.catch((caught) =>
				setError(caught instanceof Error ? caught.message : "load failed"),
			);
	}, []);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Devices
			</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
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
