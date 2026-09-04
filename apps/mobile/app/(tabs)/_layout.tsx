import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Login from "../../src/components/Login.tsx";
import { useAuth } from "../../src/lib/auth.tsx";
import { useColorMode } from "../../src/lib/color-mode.tsx";

const logo = require("../../assets/logo.png");

export default function TabsLayout() {
	const auth = useAuth();
	const { colors, isDark, toggleMode } = useColorMode();
	const insets = useSafeAreaInsets();

	if (!auth.ready || !auth.token) {
		return <Login />;
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
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
					onPress={toggleMode}
					accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
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
				initialRouteName="index"
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
						title: "Project",
						tabBarIcon: ({ color, size }) => (
							<MaterialIcons name="folder" color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="index"
					options={{
						title: "Devices",
						tabBarIcon: ({ color, size }) => (
							<MaterialIcons name="memory" color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						tabBarIcon: ({ color, size }) => (
							<MaterialIcons name="account-circle" color={color} size={size} />
						),
					}}
				/>
			</Tabs>
		</View>
	);
}
