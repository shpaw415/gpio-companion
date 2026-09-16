import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { translateError } from "gpio-companion-i18n";
import { useEffect } from "react";
import { getGithubApp, openExternal } from "../api";
import {
	CACHE_KEYS,
	useCachedQuery,
	useUserBoards,
} from "../hooks/useApiCache";
import { useT } from "../locale";
import DebugLog from "./DebugLog";
import { LinesSkeleton } from "./skeletons";

export default function Keys() {
	const t = useT();
	const github = useCachedQuery(CACHE_KEYS.githubApp, getGithubApp);
	const { devices } = useUserBoards();
	const status = github.data;
	const paired = devices.length;
	const error = github.error;
	const loading = github.loading;
	const shown = translateError(t, error);

	useEffect(() => {
		if ((status?.connected && !status.installUrl) || loading) {
			return;
		}
		const timer = window.setInterval(() => {
			void getGithubApp()
				.then((next) => github.setData(next))
				.catch(() => undefined);
		}, 2500);
		return () => window.clearInterval(timer);
	}, [status?.connected, status?.installUrl, loading, github.setData]);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				{t("github.title")}
			</Typography>
			<Typography color="secondary">
				{t("github.nativeHint", { n: paired })}
			</Typography>
			{shown ? <Alert severity="error">{shown}</Alert> : null}
			{shown ? <DebugLog error={shown} /> : null}
			<Paper sx={{ p: 3 }} elevation={1}>
				{loading ? <LinesSkeleton lines={2} /> : null}
				{loading ? null : status?.connected && !status.installUrl ? (
					<Typography>
						{t("github.connectedAs", {
							login: status.login || t("github.yourAccount"),
						})}
					</Typography>
				) : (
					<Stack spacing={2}>
						<Typography color="secondary">
							{status?.connected
								? t("github.authorizeAgainNative")
								: t("github.notConnectedPoll")}
						</Typography>
						<Button
							variant="contained"
							disabled={!status?.installUrl}
							onClick={() => void openExternal(status?.installUrl ?? "")}
						>
							{status?.connected
								? t("project.authorizeRepos")
								: t("github.connect")}
						</Button>
					</Stack>
				)}
			</Paper>
		</Stack>
	);
}
