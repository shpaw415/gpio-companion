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
import { SectionHeader } from "../../components/Section.tsx";
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
	}, [session.data?.id]);

	function signOut() {
		void clearOfflineKeys();
		auth?.logout();
		document.cookie = "access_token=; Max-Age=0; path=/";
		window.location.assign("/project");
	}

	return (
		<Stack spacing={3}>
			<SectionHeader title={t("profile.title")}>
				<Typography color="secondary">{t("profile.subtitle")}</Typography>
			</SectionHeader>

			<LanguageCard />

			{!loggedIn ? (
				<LoginPanel />
			) : (
				<>
					<Paper className="w-full max-w-2xl p-4 min-[900px]:p-6" elevation={1}>
						<Stack spacing={1}>
							<Typography variant="h6">{t("profile.account")}</Typography>
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
							/>
							<Stack direction="row" spacing={2} className="mt-4 flex-wrap">
								<Button href="/profile/github" variant="outlined">
									{t("nav.github")}
								</Button>
								<Button href="/profile/credits" variant="outlined">
									{t("nav.credits")}
								</Button>
								<Button variant="outlined" onClick={signOut}>
									{t("auth.signOut")}
								</Button>
							</Stack>
						</Stack>
					</Paper>
					<Paper className="w-full max-w-2xl p-4 min-[900px]:p-6" elevation={1}>
						<Stack spacing={1}>
							<Typography variant="h6">{t("mode.title")}</Typography>
							<Typography color="secondary">{t("mode.hint")}</Typography>
							<Button variant="outlined" onClick={toggleMode}>
								{isEasy ? t("mode.usingEasy") : t("mode.usingExpert")}
							</Button>
						</Stack>
					</Paper>
					<Paper className="w-full max-w-2xl p-4 min-[900px]:p-6" elevation={1}>
						<Stack spacing={1}>
							<Typography variant="h6">{t("credits.aiTitle")}</Typography>
							<Typography color="secondary">
								{t("credits.profileHint")}
							</Typography>
							{creditsLoading ? (
								<Skeleton variant="rounded" height={30} width={130} />
							) : (
								<Typography variant="h5">
									{micros === null ? "…" : formatUsd(micros)}
								</Typography>
							)}
							<Button href="/profile/credits" variant="outlined">
								{t("profile.manageCredits")}
							</Button>
						</Stack>
					</Paper>
				</>
			)}
		</Stack>
	);
}
