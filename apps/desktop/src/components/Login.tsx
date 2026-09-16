import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { authLogin } from "../api";
import { useT } from "../locale";
import DebugLog from "./DebugLog";
import LanguageCard from "./LanguageCard";

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
	const t = useT();
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function start() {
		setBusy(true);
		setError("");
		try {
			await authLogin();
			onSignedIn();
		} catch (caught) {
			const message =
				caught instanceof Error ? caught.message : t("errors.loginFailed");
			console.error("gpio-companion-desktop login", message);
			setError(message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={3} sx={{ mx: "auto", maxWidth: 448 }}>
			<Paper sx={{ p: 4 }} elevation={2}>
				<Typography variant="h5" Element="h1" align="center">
					{t("auth.signInWithGithub")}
				</Typography>
				<Typography color="secondary" align="center" sx={{ mt: 2, mb: 6 }}>
					{t("auth.helperDesktop")}
				</Typography>
				<Stack spacing={2}>
					<Button
						variant="contained"
						disabled={busy}
						onClick={() => void start()}
					>
						{busy ? t("auth.waitingGithub") : t("auth.continueWithGithub")}
					</Button>
				</Stack>
				{error ? (
					<Alert severity="error" sx={{ mt: 4 }}>
						{error}
					</Alert>
				) : null}
				{error ? <DebugLog error={error} /> : null}
			</Paper>
			<LanguageCard />
		</Stack>
	);
}
