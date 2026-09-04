import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import {
	getT3Status,
	openExternal,
	startT3Pair,
	type T3Status,
} from "../api";

export default function T3Pairing({
	uuid,
	initial,
}: {
	uuid: string;
	initial?: T3Status;
}) {
	const [status, setStatus] = useState<T3Status | undefined>(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!uuid || status?.paired) {
			return;
		}
		let cancelled = false;
		const timer = window.setInterval(() => {
			void getT3Status(uuid)
				.then((next) => {
					if (!cancelled) {
						setStatus(next);
					}
				})
				.catch(() => undefined);
		}, 4000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [uuid, status?.paired]);

	async function pair() {
		setBusy(true);
		setError("");
		try {
			const next = await startT3Pair(uuid);
			setStatus(next);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "T3 pair failed");
		} finally {
			setBusy(false);
		}
	}

	if (status?.paired) {
		return (
			<Typography color="secondary">T3 Code is paired on this board.</Typography>
		);
	}

	return (
		<Stack spacing={1}>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{status?.pairingUrl ? (
				<Button
					variant="text"
					onClick={() => void openExternal(status.pairingUrl ?? "")}
				>
					Open T3 pairing URL
				</Button>
			) : null}
			<Button variant="text" disabled={busy || !uuid} onClick={() => void pair()}>
				{busy ? "Minting T3 link…" : "Pair T3 Code"}
			</Button>
		</Stack>
	);
}
