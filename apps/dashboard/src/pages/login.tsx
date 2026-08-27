import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { useAuth, useAuthSession } from "../hooks/useAuth.ts";
import { syncAccessTokenCookie } from "../lib/auth/access-token-cookie.ts";
import { resolveUserIdentity } from "../lib/auth/identity.ts";

export default function LoginPage() {
	const auth = useAuth();
	const session = useAuthSession();
	const [error, setError] = useState("");

	useEffect(() => {
		if (session.data?.id || session.data?.email) {
			window.location.assign("/");
		}
	}, [session.data?.id, session.data?.email]);

	async function start(provider: "google" | "password" | "passkey") {
		if (!auth) {
			setError("auth unavailable");
			return;
		}
		setError("");
		try {
			if (provider === "passkey") {
				await auth.passkey.login();
				const token = (auth as { getToken?: () => string | null }).getToken?.();
				if (token) {
					syncAccessTokenCookie(token);
				}
				await resolveUserIdentity(auth);
				window.location.assign("/");
				return;
			}
			await auth.login({
				autoNavigate: true,
				provider,
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
				gpio-companion is multi-user. Pair hardware after you sign in.
			</Typography>
			<Stack spacing={2}>
				<Button variant="outlined" onClick={() => void start("google")}>
					Continue with Google
				</Button>
				<Button variant="outlined" onClick={() => void start("passkey")}>
					Continue with passkey
				</Button>
				<Button variant="contained" onClick={() => void start("password")}>
					Continue with email
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
