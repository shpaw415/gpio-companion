import { GET as getGithubApp, POST as saveGithubApp } from "@api/github-app";
import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Skeleton from "@shpaw415/mui-lite/Skeleton";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useState } from "react";
import { useActionError } from "../hooks/useActionError.tsx";
import { useAuth, useAuthSession } from "../hooks/useAuth.ts";
import { unwrapAction } from "../lib/action.ts";
import type { StoredPairing } from "../lib/pairing-store.ts";

export default function KeysForm() {
	const session = useAuthSession();
	const auth = useAuth();
	const { run } = useActionError();
	const [login, setLogin] = useState("");
	const [installUrl, setInstallUrl] = useState("");
	const [checking, setChecking] = useState(true);
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [devicesLoading, setDevicesLoading] = useState(true);
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");

	const onGithubAppCallbackEvent = useCallback(
		(code: string, installationId: string, state: string) => {
			const pending = Boolean((installationId || code) && state);
			if (!session.data?.id) {
				if (!pending) {
					setChecking(false);
				}
				return Promise.resolve(false);
			}
			setChecking(true);

			return (async () => {
				try {
					if (pending) {
						const saved = unwrapAction(
							await saveGithubApp({
								installationId,
								code,
								state,
								redirectUri: `${window.location.origin}${window.location.pathname}`,
							}),
						);
						setLogin(saved.login);
						setInstallUrl("");
						setStatus(`connected as @${saved.login}`);
						return true;
					}
					const current = unwrapAction(await getGithubApp());
					setLogin(current.login);
					setInstallUrl(current.installUrl);
					return true;
				} catch (caught) {
					setError(
						caught instanceof Error ? caught.message : "github app failed",
					);
					return false;
				} finally {
					setChecking(false);
				}
			})();
		},
		[session.data?.id],
	);

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
		const params = new URLSearchParams(window.location.search);
		const installationId = params.get("installation_id") ?? "";
		const code = params.get("code") ?? "";
		const state = params.get("state") ?? "";

		if (installationId && code && state) {
			window.localStorage.setItem(
				"github_app_callback",
				JSON.stringify({ installationId, code, state }),
			);
			window.history.replaceState({}, "", window.location.pathname);
		}

		console.log(auth);
		const storedString = window.localStorage.getItem("github_app_callback");
		if (!storedString) {
			void onGithubAppCallbackEvent("", "", "");
			return;
		}
		const stored = JSON.parse(storedString) as {
			installationId: string;
			code: string;
			state: string;
		};
		void onGithubAppCallbackEvent(
			stored.code,
			stored.installationId,
			stored.state,
		).then((success) => {
			window.localStorage.removeItem("github_app_callback");

			if (success) {
				window.history.replaceState({}, "", "/profile/github");
			}
		});
	}, [onGithubAppCallbackEvent]);

	if (!session.data?.id && !session.data?.email) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					Sign in
				</Button>{" "}
				to connect GitHub.
			</Typography>
		);
	}

	return (
		<Paper className="w-full max-w-xl p-4 min-[900px]:p-6" elevation={1}>
			<Stack spacing={2}>
				<Typography variant="body2" color="secondary">
					Install the gpio-companion GitHub App once. Boards mint a fresh token
					at git push — nothing to paste.
				</Typography>
				{checking ? (
					<Skeleton variant="rounded" height={40} width="60%" />
				) : login && !installUrl ? (
					<Alert severity="success">Connected as @{login}</Alert>
				) : installUrl ? (
					<Stack spacing={1}>
						{login ? (
							<Alert severity="info">
								Connected as @{login}. Authorize again to create projects.
							</Alert>
						) : null}
						<Button href={installUrl} variant="contained">
							{login ? "Authorize creating repositories" : "Connect GitHub"}
						</Button>
					</Stack>
				) : (
					<Typography color="secondary">GitHub App not connected.</Typography>
				)}
				{devicesLoading ? (
					<Skeleton variant="rounded" height={24} width="75%" />
				) : devices.length === 0 ? (
					<Alert severity="info">
						<Button href="/devices" variant="text">
							Pair a board
						</Button>{" "}
						so the agent can push with this GitHub App.
					</Alert>
				) : (
					<Typography color="secondary">
						{devices.length} paired board{devices.length === 1 ? "" : "s"} will
						use this App at git push.
					</Typography>
				)}
				{status ? <Alert severity="success">{status}</Alert> : null}
				{error ? <Alert severity="error">{error}</Alert> : null}
			</Stack>
		</Paper>
	);
}
