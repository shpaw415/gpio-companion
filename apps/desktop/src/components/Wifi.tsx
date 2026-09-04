import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	bleScan,
	bleWifi,
	type Device,
	listDevices,
	type NearbyBoard,
	nearbyBoardLabel,
	onBleStatus,
} from "../api";
import DebugLog from "./DebugLog";
import { SelectSkeleton } from "./skeletons";

export default function Wifi({ onBack }: { onBack: () => void }) {
	const [devices, setDevices] = useState<Device[]>([]);
	const [boards, setBoards] = useState<NearbyBoard[]>([]);
	const [uuid, setUuid] = useState("");
	const [boardId, setBoardId] = useState("auto");
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [scanning, setScanning] = useState(false);
	const [busy, setBusy] = useState(false);
	const [devicesLoading, setDevicesLoading] = useState(true);
	const scanRef = useRef(0);

	useEffect(() => {
		void listDevices()
			.then((result) => {
				setDevices(result.devices);
				setUuid(result.devices.at(-1)?.uuid ?? "");
			})
			.catch((caught) => {
				const message =
					caught instanceof Error ? caught.message : "load failed";
				console.error("gpio-companion-desktop wifi devices", message);
				setError(message);
			})
			.finally(() => setDevicesLoading(false));
		let unlisten: (() => void) | undefined;
		void onBleStatus(setStatus).then((fn) => {
			unlisten = fn;
		});
		return () => unlisten?.();
	}, []);

	const scan = useCallback(async () => {
		const generation = ++scanRef.current;
		setScanning(true);
		setError("");
		try {
			const next = await bleScan();
			if (scanRef.current !== generation) {
				return;
			}
			setBoards(next);
			const pick =
				next.find((board) => board.matched)?.id ?? next[0]?.id ?? "auto";
			setBoardId(pick);
		} catch (caught) {
			if (scanRef.current !== generation) {
				return;
			}
			const message = caught instanceof Error ? caught.message : "scan failed";
			console.error("gpio-companion-desktop wifi scan", message);
			setError(message);
		} finally {
			if (scanRef.current === generation) {
				setScanning(false);
			}
		}
	}, []);

	useEffect(() => {
		void scan();
	}, [scan]);

	async function send() {
		const trimmedSsid = ssid.trim();
		if (!trimmedSsid) {
			setError("Enter a WiFi network name (SSID)");
			return;
		}
		if (psk.length < 8) {
			setError("WiFi password must be at least 8 characters");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const raw = await bleWifi({
				uuid,
				ssid: trimmedSsid,
				psk,
				id: boardId === "auto" ? "" : boardId,
			});
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
			<Typography color="secondary">
				Pick the Pi in Nearby Bluetooth device, or leave Auto-detect
				and hold it close.
			</Typography>
			{devicesLoading ? (
				<SelectSkeleton height={56} width="100%" />
			) : (
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
			)}
			<Select
				name="board"
				label="Nearby Bluetooth device"
				value={boardId}
				onSelect={(next) => setBoardId(next)}
				sx={{ width: "100%" }}
				disabled={scanning || busy}
			>
				{[
					<option key="auto" value="auto">
						{scanning
							? "Scanning…"
							: boards.length === 0
								? "No nearby devices — scan again"
								: "Auto-detect gpio-companion"}
					</option>,
					...boards.map((board) => (
						<option key={board.id} value={board.id}>
							{nearbyBoardLabel(board)}
						</option>
					)),
				]}
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
			<Button
				variant="contained"
				disabled={busy || scanning || !uuid}
				onClick={() => void send()}
			>
				Send to board
			</Button>
			<Button
				variant="text"
				disabled={busy || scanning}
				onClick={() => void scan()}
			>
				Scan nearby
			</Button>
			<Button variant="text" onClick={onBack}>
				Back
			</Button>
		</Stack>
	);
}
