import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useState } from "react";
import { blePair, bleScan, type NearbyBoard, onBleStatus } from "../api";
import DebugLog from "./DebugLog";

function boardLabel(board: NearbyBoard) {
	const name = board.name.trim();
	if (board.matched) {
		return name || board.id;
	}
	if (name && name !== board.id) {
		return `${name} — ${board.id}`;
	}
	return board.id;
}

export default function Pair({ onBack }: { onBack: () => void }) {
	const [boards, setBoards] = useState<NearbyBoard[]>([]);
	const [selected, setSelected] = useState("");
	const [status, setStatus] = useState("Ready to scan");
	const [error, setError] = useState("");
	const [scanning, setScanning] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		void onBleStatus(setStatus).then((fn) => {
			unlisten = fn;
		});
		return () => unlisten?.();
	}, []);

	const scan = useCallback(async () => {
		setScanning(true);
		setError("");
		try {
			const next = await bleScan();
			setBoards(next);
			const pick = next.find((board) => board.matched)?.id ?? next[0]?.id ?? "";
			setSelected(pick);
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "scan failed";
			console.error("gpio-companion-desktop scan", message);
			setError(message);
		} finally {
			setScanning(false);
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
				Automatic discovery misses some Pi adverts. Scan nearby Bluetooth
				devices and select the board to pair with.
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
						{boardLabel(board)}
					</option>
				))}
			</Select>
			<Typography>{status}</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
			<Button
				variant="contained"
				disabled={busy || scanning || !selected}
				onClick={() => void pair()}
			>
				Pair selected device
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
