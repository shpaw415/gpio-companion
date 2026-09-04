import { useURL } from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
	firstParam,
	resolveAuthCallbackUrl,
} from "../../src/lib/auth-callback.ts";
import { useAuth } from "../../src/lib/auth.tsx";
import { authRedirectUri } from "../../src/lib/config.ts";
import { colors } from "../../src/lib/theme.ts";

export default function AuthCallbackScreen() {
	const auth = useAuth();
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
			<View style={styles.center}>
				<Text style={styles.error}>{error}</Text>
				<Text style={styles.muted}>Close this screen and sign in again.</Text>
			</View>
		);
	}

	return (
		<View style={styles.center}>
			<ActivityIndicator />
			<Text style={styles.muted}>Finishing sign-in…</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	center: {
		flex: 1,
		backgroundColor: colors.bg,
		padding: 24,
		justifyContent: "center",
		gap: 12,
	},
	muted: { color: colors.muted, textAlign: "center" },
	error: { color: colors.danger, textAlign: "center" },
});
