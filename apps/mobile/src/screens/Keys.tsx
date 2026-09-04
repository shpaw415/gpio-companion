import { useCallback, useEffect } from "react";
import { Linking } from "react-native";
import { getGithubApp } from "../lib/api.ts";
import { CACHE_KEYS, useCachedQuery, useUserBoards } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { Body, ErrorText, Muted, Paper, PrimaryButton, Screen, Skeleton, Title } from "../components/ui.tsx";

export default function Keys() {
	const auth = useAuth();
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
		if (status?.connected || github.loading) {
			return;
		}
		const timer = setInterval(() => {
			void fetcher()
				.then((next) => github.setData(next))
				.catch(() => undefined);
		}, 2500);
		return () => clearInterval(timer);
	}, [status?.connected, github.loading, fetcher, github.setData]);

	return (
		<Screen>
			<Title>Keys</Title>
			<Muted>
				Connect the gpio-companion GitHub App so the Pi can push project files.
				{devices.length ? ` ${devices.length} paired board(s).` : ""}
			</Muted>
			<ErrorText>{github.error}</ErrorText>
			<Paper>
				{github.loading ? <Skeleton height={40} /> : null}
				{github.loading ? null : status?.connected ? (
					<Body>GitHub App connected as {status.login || "your account"}.</Body>
				) : (
					<>
						<Muted>
							GitHub App is not connected. Finish the install in your browser; this page polls until it shows up.
						</Muted>
						<PrimaryButton
							label="Connect GitHub App"
							disabled={!status?.installUrl}
							onPress={() => void Linking.openURL(status?.installUrl ?? "")}
						/>
					</>
				)}
			</Paper>
		</Screen>
	);
}
