import { useURL } from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/lib/auth.tsx";
import { colors } from "../../src/lib/theme.ts";

export default function AuthCallbackScreen() {
	const auth = useAuth();
	const url = useURL();
	const handled = useRef(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!url || handled.current) {
			return;
		}
		handled.current = true;
		void auth
			.completeAuthCallback(url)
			.then(() => router.replace("/"))
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "sign-in failed");
			});
	}, [url, auth]);

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
