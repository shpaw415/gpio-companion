import { GET as getCredits, POST as grantCredits } from "@api/credits";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { SectionHeader } from "../../components/Section.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { unwrapAction } from "../../lib/action.ts";
import { formatUsd } from "../../lib/credits.ts";

export default function CreditsPage() {
	const session = useAuthSession();
	const [micros, setMicros] = useState<number | null>(null);
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");

	useEffect(() => {
		if (!session.data?.id) {
			return;
		}
		void getCredits()
			.then((result) => setMicros(unwrapAction(result).micros))
			.catch((caught: unknown) => {
				setError(caught instanceof Error ? caught.message : "load failed");
			});
	}, [session.data?.id]);

	if (!session.data?.id && !session.data?.email) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					Sign in
				</Button>{" "}
				to manage AI credits.
			</Typography>
		);
	}

	return (
		<Stack spacing={3}>
			<SectionHeader title="Credits" />
			<Typography color="secondary">
				OpenCode on the Pi spends gpio-companion balance at Cloudflare Workers
				AI list price (in/out tokens) times markup. Empty balance returns 402.
				Paid checkout is not wired yet; grant is a host stub.
			</Typography>
			<Paper className="w-full max-w-xl p-4 min-[900px]:p-6" elevation={1}>
				<Stack spacing={2}>
					<Typography variant="h5">
						{micros === null ? "…" : formatUsd(micros)}
					</Typography>
					<Button
						variant="contained"
						className="w-full min-[900px]:w-auto"
						onClick={() => {
							setError("");
							void grantCredits(1)
								.then((result) => {
									setMicros(unwrapAction(result).micros);
									setStatus("granted $1.00");
								})
								.catch((caught: unknown) => {
									setError(
										caught instanceof Error ? caught.message : "grant failed",
									);
								});
						}}
					>
						Add $1.00 (stub)
					</Button>
					{status ? <Alert severity="success">{status}</Alert> : null}
					{error ? <Alert severity="error">{error}</Alert> : null}
				</Stack>
			</Paper>
		</Stack>
	);
}
