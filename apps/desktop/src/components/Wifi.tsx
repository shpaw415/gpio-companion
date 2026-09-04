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
	type KnownNetwork,
	knownNetworkLabel,
	type NearbyBoard,
	nearbyBoardLabel,
	onBleStatus,
	wifiKnownNetworks,
	wifiNetworkPsk,
	wifiRememberNetwork,
} from "../api";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import DebugLog from "./DebugLog";
import { SelectSkeleton } from "./skeletons";

const MANUAL = "manual";

function networkValue(ssid: string) {
	return `ssid:${ssid}`;
}

export default function Wifi({ onBack }: { onBack: () => void }) {
	const {
		devices,
		loading: devicesLoading,
		error: devicesError,
	} = useUserBoards();
	const { uuid: selectedBoard } = useBoardSelection();
	const [boards, setBoards] = useState<NearbyBoard[]>([]);
	const [uuid, setUuid] = useState("");
	const [boardId, setBoardId] = useState("auto");
	const [networks, setNetworks] = useState<KnownNetwork[]>([]);
	const [networkId, setNetworkId] = useState(MANUAL);
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [scanning, setScanning] = useState(false);
	const [busy, setBusy] = useState(false);
	const scanRef = useRef(0);

	useEffect(() => {
		setUuid((current) => {
			if (devices.some((device) => device.uuid === current)) {
				return current;
			}
			if (devices.some((device) => device.uuid === selectedBoard)) {
				return selectedBoard;
			}
			return devices.at(-1)?.uuid ?? "";
		});
	}, [devices, selectedBoard]);

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		void onBleStatus(setStatus).then((fn) => {
			unlisten = fn;
		});
		return () => unlisten?.();
	}, []);

	const applyNetwork = useCallback(async (network: KnownNetwork) => {
		setSsid(network.ssid);
		if (network.psk) {
			setPsk(network.psk);
			return;
		}
		try {
			const secret = await wifiNetworkPsk(network.ssid);
			setPsk(secret);
		} catch {
			setPsk("");
		}
	}, []);

	const loadNetworks = useCallback(async () => {
		try {
			const next = await wifiKnownNetworks();
			setNetworks(next);
			const current = next.find((network) => network.current && network.psk);
			if (current) {
				setNetworkId(networkValue(current.ssid));
				await applyNetwork(current);
			}
		} catch {
			setNetworks([]);
		}
	}, [applyNetwork]);

	useEffect(() => {
		void loadNetworks();
	}, [loadNetworks]);

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

	async function pickNetwork(next: string) {
		setNetworkId(next);
		if (next === MANUAL) {
			return;
		}
		const ssidValue = next.startsWith("ssid:") ? next.slice(5) : next;
		const found = networks.find((network) => network.ssid === ssidValue);
		if (found) {
			await applyNetwork(found);
		}
	}

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
			try {
				await wifiRememberNetwork(trimmedSsid, psk);
				const next = await wifiKnownNetworks();
				setNetworks(next);
				setNetworkId(networkValue(trimmedSsid));
			} catch {
				// keep local fields; remember is best-effort
			}
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
				Pick the Pi in Nearby Bluetooth device, or leave Auto-detect and hold it
				close. Choose a known network to fill SSID and password, or enter them
				manually.
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
			<Select
				name="network"
				label="Saved network"
				value={networkId}
				onSelect={(next) => void pickNetwork(next)}
				sx={{ width: "100%" }}
				disabled={busy}
			>
				{[
					<option key={MANUAL} value={MANUAL}>
						Enter manually
					</option>,
					...networks.map((network) => (
						<option key={network.ssid} value={networkValue(network.ssid)}>
							{knownNetworkLabel(network)}
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
				type={showPassword ? "text" : "password"}
				value={psk}
				onChange={(event) => setPsk(event.target.value)}
			/>
			<Button
				variant="text"
				onClick={() => setShowPassword((current) => !current)}
			>
				{showPassword ? "Hide password" : "Show password"}
			</Button>
			{status ? <Typography>{status}</Typography> : null}
			{error || devicesError ? (
				<Alert severity="error">{error || devicesError}</Alert>
			) : null}
			{error || devicesError ? (
				<DebugLog error={error || devicesError} />
			) : null}
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
