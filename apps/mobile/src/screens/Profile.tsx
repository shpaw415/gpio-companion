import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { findNodeHandle, Linking, ScrollView, View } from "react-native";
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
import { type ProfileSection, useDeckNav } from "../lib/deck-nav.tsx";
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
	const t = useT();
	const [error, setError] = useState("");
	const { registerProfileJump, consumeProfileJump } = useDeckNav();
	const scrollRef = useRef<ScrollView>(null);
	const sectionRefs = useRef<Record<ProfileSection, View | null>>({
		account: null,
		github: null,
		credits: null,
	});

	function scrollToSection(section: ProfileSection) {
		const node = sectionRefs.current[section];
		const scroll = scrollRef.current;
		const handle = scroll ? findNodeHandle(scroll) : null;
		if (!node || !scroll || !handle) {
			return;
		}
		node.measureLayout(
			handle,
			(_x, y) => {
				scroll.scrollTo({ y: Math.max(0, y - 8), animated: true });
			},
			() => undefined,
		);
	}

	useEffect(() => {
		registerProfileJump(scrollToSection);
		return () => registerProfileJump(null);
	}, [registerProfileJump]);

	useFocusEffect(
		useCallback(() => {
			const timer = setTimeout(() => {
				const section = consumeProfileJump();
				if (section) {
					scrollToSection(section);
				}
			}, 60);
			return () => clearTimeout(timer);
		}, [consumeProfileJump]),
	);

	return (
		<Screen scrollRef={scrollRef}>
			<ErrorText>
				{translateError(t, error || creditsQuery.error || "")}
			</ErrorText>
			<LanguageCard />
			<View
				collapsable={false}
				ref={(node) => {
					sectionRefs.current.account = node;
				}}
			>
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
			</View>
			<View
				collapsable={false}
				ref={(node) => {
					sectionRefs.current.github = node;
				}}
			>
				<Keys />
			</View>
			<View
				collapsable={false}
				ref={(node) => {
					sectionRefs.current.credits = node;
				}}
			>
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
			</View>
		</Screen>
	);
}
