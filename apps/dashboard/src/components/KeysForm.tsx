import { GET as getGithubApp, POST as saveGithubApp } from "@api/github-app";
import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Skeleton from "@shpaw415/mui-lite/Skeleton";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { translateError } from "gpio-companion/i18n";
import { useEffect, useState } from "react";
import { useActionError } from "../hooks/useActionError.tsx";
import { useAuthSession } from "../hooks/useAuth.ts";
import { useT } from "../hooks/useLocale.tsx";
import { unwrapAction } from "../lib/action.ts";
import {
	peekGithubAppCallback,
	stashGithubAppCallbackFromLocation,
	takeGithubAppCallback,
} from "../lib/github-app-callback.ts";
import type { StoredPairing } from "../lib/pairing-store.ts";

export default function KeysForm() {
	const session = useAuthSession();
	const { run } = useActionError();
	const t = useT();
	const [login, setLogin] = useState("");
	const [installUrl, setInstallUrl] = useState("");
	const [checking, setChecking] = useState(true);
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [devicesLoading, setDevicesLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!session.data?.id) {
			setDevices([]);
			setDevicesLoading(false);
			return;
		}
		setDevicesLoading(true);
		void run(getPairing())
			.then((result) => {
				setDevices(result?.devices ?? []);
			})
			.finally(() => {
				setDevicesLoading(false);
			});
	}, [session.data?.id, run]);

	useEffect(() => {
		stashGithubAppCallbackFromLocation();
		const pending = peekGithubAppCallback();
		if (!session.data?.id) {
			if (!pending) {
				setChecking(false);
			}
			return;
		}
		setChecking(true);
		void (async () => {
			try {
				if (pending) {
					const saved = unwrapAction(
						await saveGithubApp({
							code: pending.code,
							state: pending.state,
							installationId: pending.installationId,
							redirectUri: pending.redirectUri,
						}),
					);
					takeGithubAppCallback();
					setLogin(saved.login);
					setInstallUrl("");
					window.history.replaceState({}, "", "/profile/github");
					return;
				}
				const current = unwrapAction(await getGithubApp());
				setLogin(current.login);
				setInstallUrl(current.installUrl);
			} catch (caught) {
				setError(
					translateError(
						t,
						caught instanceof Error ? caught.message : "github app failed",
					),
				);
			} finally {
				setChecking(false);
			}
		})();
	}, [session.data?.id, t]);

	if (!session.data?.id && !session.data?.email) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					{t("auth.signIn")}
				</Button>{" "}
				{t("auth.toGithub")}
			</Typography>
		);
	}

	return (
		<Paper className="w-full max-w-xl p-4 min-[900px]:p-6" elevation={1}>
			<Stack spacing={2}>
				<Typography variant="body2" color="secondary">
					{t("github.formHint")}
				</Typography>
				{checking ? (
					<Skeleton variant="rounded" height={40} width="60%" />
				) : login && !installUrl ? (
					<Alert severity="success">{t("github.connectedAs", { login })}</Alert>
				) : installUrl ? (
					<Stack spacing={1}>
						{login ? (
							<Alert severity="info">
								{t("github.authorizeAgain", { login })}
							</Alert>
						) : null}
						<Button href={installUrl} variant="contained">
							{login ? t("project.authorizeRepos") : t("project.connectGithub")}
						</Button>
					</Stack>
				) : (
					<Typography color="secondary">{t("github.notConnected")}</Typography>
				)}
				{devicesLoading ? (
					<Skeleton variant="rounded" height={24} width="75%" />
				) : devices.length === 0 ? (
					<Alert severity="info">
						<Button href="/devices" variant="text">
							{t("github.pairSoPush")}
						</Button>
					</Alert>
				) : (
					<Typography color="secondary">
						{t("github.nBoardsPush", { n: devices.length })}
					</Typography>
				)}
				{error ? <Alert severity="error">{error}</Alert> : null}
			</Stack>
		</Paper>
	);
}
