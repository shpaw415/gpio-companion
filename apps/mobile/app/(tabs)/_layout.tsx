import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Login from "../../src/components/Login.tsx";
import { useAuth } from "../../src/lib/auth.tsx";
import { useColorMode } from "../../src/lib/color-mode.tsx";
import { useDashboardMode } from "../../src/lib/dashboard-mode.tsx";
import { useT } from "../../src/lib/locale.tsx";

const logo = require("../../assets/logo.png");

export default function TabsLayout() {
	const auth = useAuth();
	const { colors, isDark, toggleMode } = useColorMode();
	const { isEasy, toggleMode: toggleDashboardMode } = useDashboardMode();
	const t = useT();
	const insets = useSafeAreaInsets();

	if (!auth.ready || !auth.token) {
		return <Login />;
	}

	return (
		<KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
			<View
				style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						paddingHorizontal: 12,
						paddingVertical: 8,
						gap: 10,
						borderBottomWidth: 1,
						borderBottomColor: colors.border,
					}}
				>
					<Image
						source={logo}
						style={{ width: 32, height: 32, borderRadius: 8 }}
					/>
					<Text
						style={{
							color: colors.text,
							fontSize: 18,
							fontWeight: "600",
							flexGrow: 1,
						}}
						numberOfLines={1}
					>
						gpio-companion
					</Text>
					<Pressable
						onPress={toggleDashboardMode}
						accessibilityLabel={
							isEasy ? t("mode.switchToExpert") : t("mode.switchToEasy")
						}
						style={{ padding: 8 }}
					>
						<Text style={{ color: colors.primary, fontWeight: "600" }}>
							{isEasy ? t("mode.easy") : t("mode.expert")}
						</Text>
					</Pressable>
					<Pressable
						onPress={toggleMode}
						accessibilityLabel={
							isDark ? t("theme.switchToLight") : t("theme.switchToDark")
						}
						style={{ padding: 8 }}
					>
						<MaterialIcons
							name={isDark ? "wb-sunny" : "brightness-2"}
							size={22}
							color={colors.muted}
						/>
					</Pressable>
				</View>
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
			</View>
		</KeyboardAvoidingView>
	);
}
