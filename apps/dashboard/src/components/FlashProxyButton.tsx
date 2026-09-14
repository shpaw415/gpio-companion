import { GET as loadArduinoProxy } from "@api/arduino-proxy";
import { GET as loadFlashPorts } from "@api/flash/ports";
import { POST as startFlashProxy } from "@api/flash/proxy";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	type ArduinoProxyStatus,
	ARDUINO_PROXY_FQBNS,
	arduinoProxyBoard,
	type FlashPort,
	isArduinoProxyFqbn,
} from "gpio-companion";
import { useCallback, useEffect, useState } from "react";
import { useDeviceHub } from "../hooks/useDeviceHub.ts";
import { unwrapAction } from "../lib/action.ts";

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
		const listed = unwrapAction(await loadFlashPorts(uuid));
		setPorts(listed.ports);
		const first = listed.ports.find((item) =>
			item.fqbn ? isArduinoProxyFqbn(item.fqbn) : true,
		);
		if (first?.address) {
			setPort(first.address);
		}
		if (first?.fqbn && isArduinoProxyFqbn(first.fqbn)) {
			setFqbn(first.fqbn);
		}
		try {
			setProxy(unwrapAction(await loadArduinoProxy(uuid)));
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
			<Stack direction="row" spacing={1} className="flex-wrap items-center">
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
				<Select
					name="proxy-port"
					label="Port"
					value={port}
					onSelect={setPort}
					className="w-full"
				>
					{ports.map((item) => (
						<option key={item.address} value={item.address}>
							{item.name || item.address}
						</option>
					))}
				</Select>
			) : null}
			<Select
				name="proxy-fqbn"
				label="Board"
				value={fqbn}
				onSelect={setFqbn}
				className="w-full"
			>
				{ARDUINO_PROXY_FQBNS.map((id) => (
					<option key={id} value={id}>
						{arduinoProxyBoard(id)?.name || id}
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
						.then((result) => {
							unwrapAction(result);
						})
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
