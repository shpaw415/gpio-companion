import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.ts";
import { syncAccessTokenCookie } from "../lib/auth/access-token-cookie.ts";

export default function AuthCallbackPage() {
	const auth = useAuth();
	const [error, setError] = useState("");

	useEffect(() => {
		if (!auth) {
			return;
		}
		let cancelled = false;
		auth
			.callback()
			.then(() => {
				if (cancelled) {
					return;
				}
				const token = (auth as { getToken?: () => string | null }).getToken?.();
				if (token) {
					syncAccessTokenCookie(token);
				}
				window.location.assign("/");
			})
			.catch((caught: unknown) => {
				if (!cancelled) {
					setError(
						caught instanceof Error ? caught.message : "callback failed",
					);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [auth]);

	if (error) {
		return (
			<Paper className="mx-auto max-w-md p-8" elevation={1}>
				<Typography color="error" className="mb-4">
					{error}
				</Typography>
				<Button href="/login" variant="contained">
					Back to login
				</Button>
			</Paper>
		);
	}

	return (
		<Paper className="mx-auto max-w-md p-8" elevation={1}>
			<Stack spacing={2} alignItems="center">
				<CircularProgress />
				<Typography color="secondary">Signing in…</Typography>
			</Stack>
		</Paper>
	);
}
