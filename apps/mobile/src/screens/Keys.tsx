import { useCallback, useEffect } from "react";
import { Linking, View } from "react-native";
import {
	Body,
	ErrorText,
	Muted,
	Paper,
	PrimaryButton,
	Skeleton,
	Title,
} from "../components/ui.tsx";
import { getGithubApp } from "../lib/api.ts";
import {
	CACHE_KEYS,
	useCachedQuery,
	useUserBoards,
} from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { translateError, useT } from "../lib/locale.tsx";

export default function Keys() {
	const auth = useAuth();
	const t = useT();
	const token = auth.token;
	const github = useCachedQuery(CACHE_KEYS.githubApp, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return getGithubApp(token);
	});
	const { devices } = useUserBoards();
	const status = github.data;
	const fetcher = useCallback(() => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return getGithubApp(token);
	}, [token]);

	useEffect(() => {
		if ((status?.connected && !status.installUrl) || github.loading) {
			return;
		}
		const timer = setInterval(() => {
			void fetcher()
				.then((next) => github.setData(next))
				.catch(() => undefined);
		}, 2500);
		return () => clearInterval(timer);
	}, [
		status?.connected,
		status?.installUrl,
		github.loading,
		fetcher,
		github.setData,
	]);

	return (
		<View style={{ gap: 12 }}>
			<Title>{t("github.title")}</Title>
			<Muted>{t("github.nativeHint", { n: devices.length })}</Muted>
			<ErrorText>{translateError(t, github.error || "")}</ErrorText>
			<Paper>
				{github.loading ? <Skeleton height={40} /> : null}
				{github.loading ? null : status?.connected && !status.installUrl ? (
					<Body>
						{t("github.connectedAs", {
							login: status.login || t("github.yourAccount"),
						})}
					</Body>
				) : (
					<>
						<Muted>
							{status?.connected
								? t("github.authorizeAgainNative")
								: t("github.notConnectedPoll")}
						</Muted>
						<PrimaryButton
							label={
								status?.connected
									? t("project.authorizeRepos")
									: t("github.connect")
							}
							disabled={!status?.installUrl}
							onPress={() => void Linking.openURL(status?.installUrl ?? "")}
						/>
					</>
				)}
			</Paper>
		</View>
	);
}
