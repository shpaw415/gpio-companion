import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import {
	type Credits,
	getCredits,
	grantCredits,
	type Session,
} from "../api";
import DebugLog from "./DebugLog";
import { LinesSkeleton } from "./skeletons";

export default function Profile({
	session,
	onSignOut,
}: {
	session: Session | null;
	onSignOut: () => void;
}) {
	const [credits, setCredits] = useState<Credits | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void getCredits()
			.then(setCredits)
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "load failed");
			})
			.finally(() => setLoading(false));
	}, []);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Profile
			</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
			<Paper sx={{ p: 3 }} elevation={1}>
				<Typography variant="subtitle1">Account</Typography>
				<Typography>{session?.name || "Signed in"}</Typography>
				<Typography color="secondary">{session?.email}</Typography>
				<Typography color="secondary">
					Role: {session?.role || "user"}
				</Typography>
				<Button
					variant="text"
					color="secondary"
					sx={{ mt: 2 }}
					onClick={onSignOut}
				>
					Sign out
				</Button>
			</Paper>
			<Paper sx={{ p: 3 }} elevation={1}>
				<Typography variant="subtitle1">Credits</Typography>
				{loading ? (
					<LinesSkeleton lines={1} />
				) : (
					<Typography color="secondary">
						{credits
							? `$${credits.usd.toFixed(2)} (${credits.micros} µUSD)`
							: "No credits yet"}
					</Typography>
				)}
				<Button
					variant="contained"
					sx={{ mt: 2 }}
					disabled={busy}
					onClick={() => {
						setBusy(true);
						void grantCredits(1)
							.then(setCredits)
							.catch((caught) => {
								setError(
									caught instanceof Error ? caught.message : "grant failed",
								);
							})
							.finally(() => setBusy(false));
					}}
				>
					Add $1.00 (stub)
				</Button>
			</Paper>
		</Stack>
	);
}
