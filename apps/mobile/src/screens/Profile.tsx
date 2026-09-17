import { useState } from "react";
import { Linking } from "react-native";
import LanguageCard from "../components/LanguageCard.tsx";
import {
	Body,
	ErrorText,
	Muted,
	Paper,
	PrimaryButton,
	Screen,
	Skeleton,
	TextButton,
} from "../components/ui.tsx";
import { getCredits } from "../lib/api.ts";
import { CACHE_KEYS, useCachedQuery } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { dashboardUrl } from "../lib/config.ts";
import { useDashboardMode } from "../lib/dashboard-mode.tsx";
import { translateError, useT } from "../lib/locale.tsx";
import Keys from "./Keys.tsx";

export default function Profile() {
	const auth = useAuth();
	const token = auth.token;
	const creditsQuery = useCachedQuery(CACHE_KEYS.credits, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return getCredits(token);
	});
	const credits = creditsQuery.data ?? null;
	const { isEasy, toggleMode } = useDashboardMode();
	const t = useT();
	const [error, setError] = useState("");

	return (
		<Screen>
			<ErrorText>
				{translateError(t, error || creditsQuery.error || "")}
			</ErrorText>
			<LanguageCard />
			<Paper>
				<Body>{t("profile.account")}</Body>
				<Body>{auth.session?.name || t("auth.signedIn")}</Body>
				<Muted>{auth.session?.email}</Muted>
				<Muted>
					{t("profile.role", {
						role: auth.session?.role || t("profile.roleUser"),
					})}
				</Muted>
				<TextButton
					label={t("auth.signOut")}
					onPress={() => void auth.logout()}
				/>
			</Paper>
			<Paper>
				<Body>{t("mode.title")}</Body>
				<Muted>{t("mode.hint")}</Muted>
				<TextButton
					label={isEasy ? t("mode.usingEasy") : t("mode.usingExpert")}
					onPress={toggleMode}
				/>
			</Paper>
			<Keys />
			<Paper>
				<Body>{t("credits.title")}</Body>
				{creditsQuery.loading ? (
					<Skeleton height={24} />
				) : (
					<Muted>
						{credits
							? t("credits.balance", {
									usd: credits.usd.toFixed(2),
									micros: credits.micros,
								})
							: t("credits.noCredits")}
					</Muted>
				)}
				<PrimaryButton
					label={t("credits.add")}
					onPress={() => {
						setError("");
						void Linking.openURL(`${dashboardUrl}/profile/credits`).catch(
							(caught) => {
								setError(
									caught instanceof Error
										? caught.message
										: t("errors.couldNotOpenCredits"),
								);
							},
						);
					}}
				/>
			</Paper>
		</Screen>
	);
}
