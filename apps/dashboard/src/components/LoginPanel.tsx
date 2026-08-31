import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth.ts";

export default function LoginPanel() {
	const auth = useAuth();
	const [error, setError] = useState("");

	async function start() {
		if (!auth) {
			setError("auth unavailable");
			return;
		}
		setError("");
		try {
			await auth.login({
				autoNavigate: true,
				provider: "github",
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "login failed");
		}
	}

	return (
		<Paper className="mx-auto max-w-md p-8" elevation={2}>
			<Typography variant="h5" Element="h1" align="center">
				Sign in
			</Typography>
			<Typography color="secondary" align="center" className="mt-2 mb-6">
				Sign in with GitHub, then pair a Pi and set up a PAT.
			</Typography>
			<Stack spacing={2}>
				<Button variant="contained" onClick={() => void start()}>
					Continue with GitHub
				</Button>
			</Stack>
			{error ? (
				<Alert severity="error" className="mt-4">
					{error}
				</Alert>
			) : null}
		</Paper>
	);
}
