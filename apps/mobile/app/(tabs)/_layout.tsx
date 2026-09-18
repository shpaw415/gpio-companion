import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Deck from "../../src/components/Deck.tsx";
import Login from "../../src/components/Login.tsx";
import { useAuth } from "../../src/lib/auth.tsx";
import { useColorMode } from "../../src/lib/color-mode.tsx";
import { useT } from "../../src/lib/locale.tsx";

export default function TabsLayout() {
	const auth = useAuth();
	const { colors } = useColorMode();
	const t = useT();
	const insets = useSafeAreaInsets();

	if (!auth.ready || !auth.token) {
		return <Login />;
	}

	return (
		<KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
			<Deck>
				<Tabs
					initialRouteName="project"
					screenOptions={{
						headerShown: false,
						lazy: false,
						freezeOnBlur: false,
						tabBarActiveTintColor: colors.primary,
						tabBarInactiveTintColor: colors.muted,
						tabBarStyle: {
							backgroundColor: colors.surface,
							borderTopColor: colors.border,
							paddingBottom: Math.max(insets.bottom, 8),
							height: 56 + Math.max(insets.bottom - 8, 0),
						},
					}}
				>
					<Tabs.Screen
						name="project"
						options={{
							title: t("nav.project"),
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="folder" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="index"
						options={{
							title: t("nav.devices"),
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="memory" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="profile"
						options={{
							title: t("nav.profile"),
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons
									name="account-circle"
									color={color}
									size={size}
								/>
							),
						}}
					/>
				</Tabs>
			</Deck>
		</KeyboardAvoidingView>
	);
}
