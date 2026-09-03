import { GET as getGithubApp, POST as saveGithubApp } from "@api/github-app";
import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { useActionError } from "../hooks/useActionError.tsx";
import { useAuthSession } from "../hooks/useAuth.ts";
import { unwrapAction } from "../lib/action.ts";
import type { StoredPairing } from "../lib/pairing-store.ts";

export default function KeysForm() {
	const session = useAuthSession();
	const { run } = useActionError();
	const [login, setLogin] = useState("");
	const [installUrl, setInstallUrl] = useState("");
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");

	useEffect(() => {
		if (!session.data?.id) {
			setDevices([]);
			return;
		}
		void run(getPairing()).then((result) => {
			setDevices(result?.devices ?? []);
		});
	}, [session.data?.id, run]);

	useEffect(() => {
		if (!session.data?.id) {
			return;
		}
		const params = new URLSearchParams(window.location.search);
		const installationId = params.get("installation_id");
		const state = params.get("state") ?? "";
		void (async () => {
			try {
				if (installationId && state) {
					const saved = unwrapAction(
						await saveGithubApp({ installationId, state }),
					);
					setLogin(saved.login);
					setInstallUrl("");
					setStatus(`connected as @${saved.login}`);
					window.history.replaceState({}, "", "/devices/keys");
					return;
				}
				const current = unwrapAction(await getGithubApp());
				setLogin(current.login);
				setInstallUrl(current.installUrl);
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : "github app failed");
			}
		})();
	}, [session.data?.id]);

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
					Install the gpio-companion GitHub App. Paired Pis mint a fresh token
					at git push — nothing to paste, and being offline for more than an
					hour does not require you to reopen this page.
				</Typography>
				{login ? (
					<Alert severity="success">Connected as @{login}</Alert>
				) : installUrl ? (
					<Button href={installUrl} variant="contained">
						Connect GitHub
					</Button>
				) : (
					<Typography color="secondary">Checking GitHub App…</Typography>
				)}
				{devices.length === 0 ? (
					<Alert severity="info">
						<Button href="/devices/pair" variant="text">
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