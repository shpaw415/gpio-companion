import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import {
	getGithubApp,
	type GithubAppStatus,
	listDevices,
	openExternal,
} from "../api";
import DebugLog from "./DebugLog";

export default function Keys() {
	const [status, setStatus] = useState<GithubAppStatus | null>(null);
	const [paired, setPaired] = useState(0);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const [app, devices] = await Promise.all([
					getGithubApp(),
					listDevices(),
				]);
				if (!cancelled) {
					setStatus(app);
					setPaired(devices.devices.length);
					setError("");
				}
			} catch (caught) {
				if (!cancelled) {
					setError(
						caught instanceof Error ? caught.message : "load failed",
					);
				}
			}
		}
		void load();
		const timer = window.setInterval(() => {
			if (status?.connected) {
				return;
			}
			void getGithubApp()
				.then((app) => {
					if (!cancelled) {
						setStatus(app);
					}
				})
				.catch(() => undefined);
		}, 2500);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [status?.connected]);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Keys
			</Typography>
			<Typography color="secondary">
				Connect the gpio-companion GitHub App so the Pi can push project files.
				{paired ? ` ${paired} paired board(s).` : ""}
			</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
			<Paper sx={{ p: 3 }} elevation={1}>
				{status?.connected ? (
					<Typography>
						GitHub App connected as {status.login || "your account"}.
					</Typography>
				) : (
					<Stack spacing={2}>
						<Typography color="secondary">
							GitHub App is not connected. Finish the install in your browser;
							this page polls until it shows up.
						</Typography>
						<Button
							variant="contained"
							disabled={!status?.installUrl}
							onClick={() =>
								void openExternal(status?.installUrl ?? "")
							}
						>
							Connect GitHub App
						</Button>
					</Stack>
				)}
			</Paper>
		</Stack>
	);
}
