import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import {
	bleFlash,
	type FlashStatus,
	loadFlash,
	loadFlashPorts,
	startFlash,
} from "../api";

export default function FlashPanel({ uuid }: { uuid: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<FlashStatus | null>(null);
	const [fqbn, setFqbn] = useState("arduino:avr:uno");
	const [dir, setDir] = useState("");
	const [port, setPort] = useState("");

	function start(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setBusy(false));
	}

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">Arduino flash</Typography>
			<Button
				variant="outlined"
				size="small"
				disabled={busy || !uuid}
				onClick={() => {
					start(async () => {
						setStatus(await loadFlash(uuid));
						const listed = await loadFlashPorts(uuid);
						const first = listed.ports[0];
						if (first?.fqbn) {
							setFqbn(first.fqbn);
						}
						if (first?.address) {
							setPort(first.address);
						}
					});
				}}
			>
				{busy ? "Loading…" : "Load ports"}
			</Button>
			<TextField
				label="FQBN"
				value={fqbn}
				onChange={(event) => setFqbn(event.target.value)}
			/>
			<TextField
				label="Sketch dir on the Pi"
				value={dir}
				onChange={(event) => setDir(event.target.value)}
			/>
			<TextField
				label="Port (optional)"
				value={port}
				onChange={(event) => setPort(event.target.value)}
			/>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="contained"
					size="small"
					disabled={busy || !fqbn.trim() || !dir.trim()}
					onClick={() => {
						start(async () => {
							await startFlash({
								uuid,
								fqbn: fqbn.trim(),
								dir: dir.trim(),
								port: port.trim() || undefined,
							});
							setStatus(await loadFlash(uuid));
						});
					}}
				>
					Flash
				</Button>
				<Button
					variant="outlined"
					size="small"
					disabled={busy || !fqbn.trim() || !dir.trim()}
					onClick={() => {
						start(async () => {
							await bleFlash({
								uuid,
								fqbn: fqbn.trim(),
								dir: dir.trim(),
								port: port.trim() || undefined,
							});
						});
					}}
				>
					Flash over Bluetooth
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			<Typography color="secondary" variant="body2">
				{status?.running
					? "Flashing…"
					: status?.last
						? status.last.ok
							? `Last flash ok · ${status.last.fqbn}`
							: `Last flash failed · ${status.last.fqbn}`
						: "C sketch on the Pi, then flash."}
			</Typography>
		</Stack>
	);
}
