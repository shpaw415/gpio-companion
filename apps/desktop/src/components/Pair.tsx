import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { blePair, onBleStatus } from "../api";

export default function Pair({ onBack }: { onBack: () => void }) {
	const [status, setStatus] = useState("Ready to scan");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		void onBleStatus(setStatus).then((fn) => {
			unlisten = fn;
		});
		return () => unlisten?.();
	}, []);

	async function pair() {
		setBusy(true);
		setError("");
		try {
			await blePair();
			setStatus("Paired");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "pair failed");
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
				Uses the same BLE service as the web dashboard. The dashboard signs the
				request; this app only writes the envelope over GATT.
			</Typography>
			<Typography>{status}</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			<Button variant="contained" disabled={busy} onClick={() => void pair()}>
				Scan gpio-companion
			</Button>
			<Button variant="text" onClick={onBack}>
				Back
			</Button>
		</Stack>
	);
}
