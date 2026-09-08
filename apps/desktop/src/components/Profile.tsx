import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { DASHBOARD_URL, getCredits, openExternal, type Session } from "../api";
import { CACHE_KEYS, useCachedQuery } from "../hooks/useApiCache";
import { useDashboardMode } from "../hooks/useDashboardMode";
import DebugLog from "./DebugLog";
import Keys from "./Keys";
import { LinesSkeleton } from "./skeletons";

export default function Profile({
	session,
	onSignOut,
}: {
	session: Session | null;
	onSignOut: () => void;
}) {
	const creditsQuery = useCachedQuery(CACHE_KEYS.credits, getCredits);
	const credits = creditsQuery.data ?? null;
	const { isEasy, toggleMode } = useDashboardMode();
	const [error, setError] = useState("");
	const loading = creditsQuery.loading;

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Profile
			</Typography>
			{error || creditsQuery.error ? (
				<Alert severity="error">{error || creditsQuery.error}</Alert>
			) : null}
			{error || creditsQuery.error ? (
				<DebugLog error={error || creditsQuery.error} />
			) : null}
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
				<Typography variant="subtitle1">Dashboard mode</Typography>
				<Typography color="secondary">
					Easy hides Linux tools. Expert shows pairing requests, debug, and
					admin.
				</Typography>
				<Button variant="outlined" sx={{ mt: 2 }} onClick={toggleMode}>
					{isEasy
						? "Using Easy — switch to Expert"
						: "Using Expert — switch to Easy"}
				</Button>
			</Paper>
			<Keys />
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
					onClick={() => {
						setError("");
						void openExternal(`${DASHBOARD_URL}/profile/credits`).catch(
							(caught) => {
								setError(
									caught instanceof Error
										? caught.message
										: "could not open credits",
								);
							},
						);
					}}
				>
					Add credits
				</Button>
			</Paper>
		</Stack>
	);
}
