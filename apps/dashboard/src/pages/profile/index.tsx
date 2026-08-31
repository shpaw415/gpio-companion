import { GET as getCredits } from "@api/credits";
import LoginPanel from "@components/LoginPanel";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { SectionHeader } from "../../components/Section.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuth, useAuthSession } from "../../hooks/useAuth.ts";
import { formatUsd } from "../../lib/credits.ts";

export default function ProfilePage() {
	const auth = useAuth();
	const session = useAuthSession();
	const { run } = useActionError();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [micros, setMicros] = useState<number | null>(null);

	useEffect(() => {
		if (!session.data?.id) {
			setMicros(null);
			return;
		}
		void run(getCredits()).then((result) =>
			setMicros(result ? result.micros : null),
		);
	}, [session.data?.id]);

	function signOut() {
		auth?.logout();
		document.cookie = "access_token=; Max-Age=0; path=/";
		window.location.assign("/project");
	}

	return (
		<Stack spacing={3}>
			<SectionHeader title="Profile">
				<Typography color="secondary">
					Your GitHub account and gpio-companion credits.
				</Typography>
			</SectionHeader>

			{!loggedIn ? (
				<LoginPanel />
			) : (
				<>
					<Paper className="max-w-2xl p-6" elevation={1}>
						<Stack spacing={1}>
							<Typography variant="h6">Account</Typography>
							{session.data?.name ? (
								<Typography>{session.data.name}</Typography>
							) : null}
							{session.data?.email ? (
								<Typography color="secondary">{session.data.email}</Typography>
							) : null}
							<Chip
								label={session.data?.role === "admin" ? "admin" : "user"}
								variant="outlined"
							/>
							<Stack direction="row" spacing={2} className="mt-4">
								<Button href="/profile/credits" variant="outlined">
									Credits
								</Button>
								<Button variant="outlined" onClick={signOut}>
									Sign out
								</Button>
							</Stack>
						</Stack>
					</Paper>
					<Paper className="max-w-2xl p-6" elevation={1}>
						<Stack spacing={1}>
							<Typography variant="h6">AI credits</Typography>
							<Typography color="secondary">
								OpenCode on your boards spends gpio-companion balance (Workers
								AI list price × markup). Empty balance returns 402 from the AI
								proxy.
							</Typography>
							<Typography variant="h5">
								{micros === null ? "…" : formatUsd(micros)}
							</Typography>
							<Button href="/profile/credits" variant="outlined">
								Manage credits
							</Button>
						</Stack>
					</Paper>
				</>
			)}
		</Stack>
	);
}
