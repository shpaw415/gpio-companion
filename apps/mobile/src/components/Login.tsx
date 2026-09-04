import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";

export default function Login() {
	const auth = useAuth();
	const colors = useColors();

	if (!auth.ready) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
				<ActivityIndicator />
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
			<Text style={{ fontSize: 22, fontWeight: "600", color: colors.text }}>
				Sign in with GitHub
			</Text>
			<Text style={{ color: colors.muted }}>
				Project, Devices, and Profile live in this app. Pair a board over Bluetooth when you are ready.
			</Text>
			{auth.error ? <Text style={{ color: colors.danger }}>{auth.error}</Text> : null}
			<Pressable
				style={{
					backgroundColor: colors.primary,
					padding: 14,
					borderRadius: 999,
					alignItems: "center",
				}}
				onPress={() => void auth.login()}
			>
				<Text style={{ color: colors.primaryText, fontWeight: "600" }}>
					Continue with GitHub
				</Text>
			</Pressable>
		</View>
	);
}
