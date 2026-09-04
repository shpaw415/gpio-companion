import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	blePair,
	bleScan,
	type NearbyBoard,
	nearbyBoardLabel,
	onBleStatus,
} from "../api";
import DebugLog from "./DebugLog";

export default function Pair({ onBack }: { onBack: () => void }) {
	const [boards, setBoards] = useState<NearbyBoard[]>([]);
	const [selected, setSelected] = useState("");
	const [status, setStatus] = useState("Ready to scan");
	const [error, setError] = useState("");
	const [scanning, setScanning] = useState(false);
	const [busy, setBusy] = useState(false);
	const [paired, setPaired] = useState(false);
	const scanRef = useRef(0);

	useEffect(() => {
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
			const pick = next.find((board) => board.matched)?.id ?? next[0]?.id ?? "";
			setSelected(pick);
		} catch (caught) {
			if (scanRef.current !== generation) {
				return;
			}
			const message = caught instanceof Error ? caught.message : "scan failed";
			console.error("gpio-companion-desktop scan", message);
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

	async function pair() {
		if (!selected) {
			setError("Select a device to pair with");
			return;
		}
		setBusy(true);
		setError("");
		try {
			await blePair(selected);
			setPaired(true);
			setStatus("Paired");
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "pair failed";
			console.error("gpio-companion-desktop pair", message);
			setError(message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Pair a board
			</Typography>
			<Typography color="secondary">
				Hold the Pi close. Unnamed radios are checked over GATT so
				gpio-companion shows up by name, not as a MAC address.
			</Typography>
			<Select
				name="board"
				label="Select device to pair with"
				value={selected}
				onSelect={(next) => setSelected(next)}
				sx={{ width: "100%" }}
				disabled={boards.length === 0 || scanning || busy}
			>
				{boards.map((board) => (
					<option key={board.id} value={board.id}>
						{nearbyBoardLabel(board)}
					</option>
				))}
			</Select>
			<Typography>{status}</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
		<Button
			variant="contained"
			disabled={busy || scanning || !selected || paired}
			onClick={() => void pair()}
		>
			Pair selected device
		</Button>
		{paired ? (
			<Button variant="contained" color="secondary" onClick={onBack}>
				Back to Devices
			</Button>
		) : null}
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
