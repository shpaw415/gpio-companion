import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useState } from "react";
import {
	type ArduinoProxyStatus,
	type FlashPort,
	loadArduinoProxy,
	loadFlashPorts,
	startFlashProxy,
} from "../api";
import { useDeviceHub } from "../hooks/useDeviceHub";

const PROXY_BOARDS = [
	{ fqbn: "arduino:avr:uno", name: "Arduino Uno" },
	{ fqbn: "arduino:avr:nano", name: "Arduino Nano" },
	{ fqbn: "arduino:avr:mega", name: "Arduino Mega 2560" },
	{ fqbn: "arduino:samd:nano_33_iot", name: "Arduino Nano 33 IoT" },
	{ fqbn: "arduino:samd:mkrwifi1010", name: "Arduino MKR WiFi 1010" },
	{ fqbn: "arduino:samd:mkrzero", name: "Arduino MKR Zero" },
	{ fqbn: "arduino:samd:mzero", name: "Arduino Zero" },
	{ fqbn: "esp32:esp32:esp32", name: "ESP32 Dev Module" },
	{ fqbn: "esp32:esp32:esp32s3", name: "ESP32-S3" },
	{ fqbn: "esp32:esp32:esp32c3", name: "ESP32-C3" },
] as const;

function isProxyFqbn(fqbn: string): boolean {
	const trimmed = fqbn.trim();
	const normalized = trimmed.startsWith("arduino:avr:mega")
		? "arduino:avr:mega"
		: trimmed;
	return PROXY_BOARDS.some(
		(board) =>
			board.fqbn === normalized || trimmed.startsWith(`${board.fqbn}:`),
	);
}

export default function FlashProxyButton({
	uuid,
	connected,
}: {
	uuid: string;
	connected?: boolean;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [ports, setPorts] = useState<FlashPort[]>([]);
	const [port, setPort] = useState("");
	const [fqbn, setFqbn] = useState("arduino:avr:uno");
	const [proxy, setProxy] = useState<ArduinoProxyStatus | null>(null);

	const load = useCallback(async () => {
		if (!uuid || connected === false) {
			setPorts([]);
			setProxy(null);
			return;
		}
		const listed = await loadFlashPorts(uuid);
		setPorts(listed.ports);
		const first = listed.ports.find((item) =>
			item.fqbn ? isProxyFqbn(item.fqbn) : true,
		);
		if (first?.address) {
			setPort(first.address);
		}
		if (first?.fqbn && isProxyFqbn(first.fqbn)) {
			setFqbn(first.fqbn);
		}
		try {
			setProxy(await loadArduinoProxy(uuid));
		} catch {
			setProxy(null);
		}
	}, [uuid, connected]);

	useEffect(() => {
		void load().catch(() => undefined);
	}, [load]);

	useDeviceHub(uuid, {
		onArduinoProxy: (status) => setProxy(status),
	});

	if (connected === false) {
		return null;
	}

	const live = Boolean(proxy?.connected);
	const hasBoard = ports.length > 0 || live;

	if (!hasBoard) {
		return null;
	}

	return (
		<Stack spacing={1}>
			<Stack
				direction="row"
				spacing={1}
				sx={{ flexWrap: "wrap", alignItems: "center" }}
			>
				<Typography variant="subtitle2">Arduino proxy</Typography>
				{live ? (
					<Chip
						label={`Firmata · ${proxy?.name || proxy?.fqbn || "connected"}`}
						color="success"
						size="small"
						variant="outlined"
					/>
				) : (
					<Chip
						label="USB Arduino"
						size="small"
						color="secondary"
						variant="outlined"
					/>
				)}
			</Stack>
			<Typography variant="body2" color="secondary">
				Flash the companion slave firmware so Live GPIO and Run on board can
				drive every pin over USB. Uno/Mega are 5V; SAMD/ESP32 are 3.3V.
			</Typography>
			{ports.length > 1 ? (
				<Select name="proxy-port" label="Port" value={port} onSelect={setPort}>
					{ports.map((item) => (
						<option key={item.address} value={item.address}>
							{item.name || item.address}
						</option>
					))}
				</Select>
			) : null}
			<Select name="proxy-fqbn" label="Board" value={fqbn} onSelect={setFqbn}>
				{PROXY_BOARDS.map((board) => (
					<option key={board.fqbn} value={board.fqbn}>
						{board.name}
					</option>
				))}
			</Select>
			{error ? <Alert severity="error">{error}</Alert> : null}
			<Button
				type="button"
				variant="contained"
				size="small"
				disabled={busy || !uuid}
				onClick={() => {
					setBusy(true);
					setError("");
					void startFlashProxy({ uuid, fqbn, port: port || undefined })
						.catch((caught) => {
							setError(
								caught instanceof Error ? caught.message : "flash failed",
							);
						})
						.finally(() => setBusy(false));
				}}
			>
				{busy
					? "Flashing…"
					: live
						? "Re-flash Arduino as proxy"
						: "Flash Arduino as proxy"}
			</Button>
		</Stack>
	);
}
