import { GET as getCredits } from "@api/credits";
import LoginPanel from "@components/LoginPanel";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Skeleton from "@shpaw415/mui-lite/Skeleton";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import LanguageCard from "../../components/LanguageCard.tsx";
import VoiceMicCard from "../../components/VoiceMicCard.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuth, useAuthSession } from "../../hooks/useAuth.ts";
import { useDashboardMode } from "../../hooks/useDashboardMode.tsx";
import { useT } from "../../hooks/useLocale.tsx";
import { formatUsd } from "../../lib/credits.ts";
import { clearOfflineKeys } from "../../lib/offline-keys.ts";

export default function ProfilePage() {
	const auth = useAuth();
	const session = useAuthSession();
	const { isEasy, toggleMode } = useDashboardMode();
	const t = useT();
	const { run } = useActionError();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [micros, setMicros] = useState<number | null>(null);
	const [creditsLoading, setCreditsLoading] = useState(true);

	useEffect(() => {
		if (!session.data?.id) {
			setMicros(null);
			setCreditsLoading(false);
			return;
		}
		setCreditsLoading(true);
		void run(getCredits())
			.then((result) => setMicros(result ? result.micros : null))
			.finally(() => setCreditsLoading(false));
	}, [session.data?.id, run]);

	function signOut() {
		void clearOfflineKeys();
		auth?.logout();
		document.cookie = "access_token=; Max-Age=0; path=/";
		window.location.assign("/project");
	}

	return (
		<Stack spacing={1.5}>
			<LanguageCard />
			<VoiceMicCard />

			{!loggedIn ? (
				<LoginPanel />
			) : (
				<>
					<Paper className="w-full p-3" elevation={1}>
						<Stack spacing={1}>
							<Typography variant="subtitle1">
								{t("profile.account")}
							</Typography>
							{session.data?.name ? (
								<Typography className="break-all">
									{session.data.name}
								</Typography>
							) : null}
							{session.data?.email ? (
								<Typography color="secondary" className="break-all">
									{session.data.email}
								</Typography>
							) : null}
							<Chip
								label={
									session.data?.role === "admin"
										? t("profile.roleAdmin")
										: t("profile.roleUser")
								}
								variant="outlined"
								size="small"
							/>
							<Stack direction="row" spacing={1} className="flex-wrap">
								<Button href="/profile/github" variant="outlined" size="small">
									{t("nav.github")}
								</Button>
								<Button href="/profile/credits" variant="outlined" size="small">
									{t("nav.credits")}
								</Button>
								<Button variant="outlined" size="small" onClick={signOut}>
									{t("auth.signOut")}
								</Button>
							</Stack>
						</Stack>
					</Paper>
					<Paper className="w-full p-3" elevation={1}>
						<Stack
							direction="row"
							spacing={1}
							className="flex-wrap items-center justify-between"
						>
							<Typography variant="subtitle1">{t("mode.title")}</Typography>
							<Button variant="outlined" size="small" onClick={toggleMode}>
								{isEasy ? t("mode.usingEasy") : t("mode.usingExpert")}
							</Button>
						</Stack>
					</Paper>
					<Paper className="w-full p-3" elevation={1}>
						<Stack
							direction="row"
							spacing={1}
							className="flex-wrap items-center justify-between"
						>
							<Stack spacing={0.25}>
								<Typography variant="subtitle1">
									{t("credits.aiTitle")}
								</Typography>
								{creditsLoading ? (
									<Skeleton variant="rounded" height={24} width={96} />
								) : (
									<Typography>
										{micros === null ? "…" : formatUsd(micros)}
									</Typography>
								)}
							</Stack>
							<Button href="/profile/credits" variant="outlined" size="small">
								{t("profile.manageCredits")}
							</Button>
						</Stack>
					</Paper>
				</>
			)}
		</Stack>
	);
}
