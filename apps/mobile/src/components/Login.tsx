import { ActivityIndicator, Pressable, Text, View } from "react-native";
import LanguageCard from "./LanguageCard.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { useT } from "../lib/locale.tsx";

export default function Login() {
	const auth = useAuth();
	const colors = useColors();
	const t = useT();

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
				{t("auth.signInWithGithub")}
			</Text>
			<Text style={{ color: colors.muted }}>{t("auth.helperMobile")}</Text>
			{auth.error ? (
				<Text style={{ color: colors.danger }}>{auth.error}</Text>
			) : null}
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
					{t("auth.continueWithGithub")}
				</Text>
			</Pressable>
			<LanguageCard />
		</View>
	);
}
