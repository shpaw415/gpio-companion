import { useURL } from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
	firstParam,
	resolveAuthCallbackUrl,
} from "../../src/lib/auth-callback.ts";
import { useAuth } from "../../src/lib/auth.tsx";
import { useColors } from "../../src/lib/color-mode.tsx";
import { authRedirectUri } from "../../src/lib/config.ts";

export default function AuthCallbackScreen() {
	const auth = useAuth();
	const colors = useColors();
	const linkingUrl = useURL();
	const params = useLocalSearchParams<{
		code?: string | string[];
		state?: string | string[];
		url?: string | string[];
	}>();
	const handled = useRef(false);
	const [error, setError] = useState("");

	const code = firstParam(params.code);
	const state = firstParam(params.state);
	const nestedUrl = firstParam(params.url);

	useEffect(() => {
		if (handled.current) {
			return;
		}
		const callbackUrl = resolveAuthCallbackUrl({
			redirectUri: authRedirectUri,
			code,
			state,
			nestedUrl,
			linkingUrl,
		});
		if (!callbackUrl) {
			return;
		}
		handled.current = true;
		void auth
			.completeAuthCallback(callbackUrl)
			.then(() => router.replace("/"))
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "sign-in failed");
			});
	}, [code, state, nestedUrl, linkingUrl, auth]);

	if (error) {
		return (
			<View
				style={{
					flex: 1,
					backgroundColor: colors.bg,
					padding: 24,
					justifyContent: "center",
					gap: 12,
				}}
			>
				<Text style={{ color: colors.danger, textAlign: "center" }}>{error}</Text>
				<Text style={{ color: colors.muted, textAlign: "center" }}>
					Close this screen and sign in again.
				</Text>
			</View>
		);
	}

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.bg,
				padding: 24,
				justifyContent: "center",
				gap: 12,
			}}
		>
			<ActivityIndicator />
			<Text style={{ color: colors.muted, textAlign: "center" }}>Finishing sign-in…</Text>
		</View>
	);
}
