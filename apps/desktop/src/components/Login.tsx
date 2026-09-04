import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { authLogin } from "../api";
import DebugLog from "./DebugLog";

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function start() {
		setBusy(true);
		setError("");
		try {
			await authLogin();
			onSignedIn();
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "login failed";
			console.error("gpio-companion-desktop login", message);
			setError(message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Paper sx={{ mx: "auto", maxWidth: 448, p: 4 }} elevation={2}>
			<Typography variant="h5" Element="h1" align="center">
				Sign in with GitHub
			</Typography>
			<Typography color="secondary" align="center" sx={{ mt: 2, mb: 6 }}>
				Pair a board over Bluetooth. Project, Keys, and Credits stay on the web
				dashboard.
			</Typography>
			<Stack spacing={2}>
				<Button
					variant="contained"
					disabled={busy}
					onClick={() => void start()}
				>
					{busy ? "Waiting for GitHub in your browser…" : "Continue with GitHub"}
				</Button>
			</Stack>
			{error ? (
				<Alert severity="error" sx={{ mt: 4 }}>
					{error}
				</Alert>
			) : null}
			{error ? <DebugLog error={error} /> : null}
		</Paper>
	);
}
