import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { DASHBOARD_URL, getCredits, openExternal, type Session } from "../api";
import { CACHE_KEYS, useCachedQuery } from "../hooks/useApiCache";
import { useDashboardMode } from "../hooks/useDashboardMode";
import { useT } from "../locale";
import DebugLog from "./DebugLog";
import Keys from "./Keys";
import LanguageCard from "./LanguageCard";
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
	const t = useT();
	const [error, setError] = useState("");
	const loading = creditsQuery.loading;

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				{t("profile.title")}
			</Typography>
			{error || creditsQuery.error ? (
				<Alert severity="error">{error || creditsQuery.error}</Alert>
			) : null}
			{error || creditsQuery.error ? (
				<DebugLog error={error || creditsQuery.error} />
			) : null}
			<LanguageCard />
			<Paper sx={{ p: 3 }} elevation={1}>
				<Typography variant="subtitle1">{t("profile.account")}</Typography>
				<Typography>{session?.name || t("auth.signedIn")}</Typography>
				<Typography color="secondary">{session?.email}</Typography>
				<Typography color="secondary">
					{t("profile.role", { role: session?.role || t("profile.roleUser") })}
				</Typography>
				<Button
					variant="text"
					color="secondary"
					sx={{ mt: 2 }}
					onClick={onSignOut}
				>
					{t("auth.signOut")}
				</Button>
			</Paper>
			<Paper sx={{ p: 3 }} elevation={1}>
				<Typography variant="subtitle1">{t("mode.title")}</Typography>
				<Typography color="secondary">{t("mode.hint")}</Typography>
				<Button variant="outlined" sx={{ mt: 2 }} onClick={toggleMode}>
					{isEasy ? t("mode.usingEasy") : t("mode.usingExpert")}
				</Button>
			</Paper>
			<Keys />
			<Paper sx={{ p: 3 }} elevation={1}>
				<Typography variant="subtitle1">{t("credits.title")}</Typography>
				{loading ? (
					<LinesSkeleton lines={1} />
				) : (
					<Typography color="secondary">
						{credits
							? t("credits.balance", {
									usd: credits.usd.toFixed(2),
									micros: credits.micros,
								})
							: t("credits.noCredits")}
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
										: t("errors.couldNotOpenCredits"),
								);
							},
						);
					}}
				>
					{t("credits.add")}
				</Button>
			</Paper>
		</Stack>
	);
}
