import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { ApiCacheProvider } from "../src/lib/api-cache.tsx";
import { AuthProvider } from "../src/lib/auth.tsx";
import { BoardSelectionProvider } from "../src/lib/board-selection.tsx";
import { ColorModeProvider, useColorMode } from "../src/lib/color-mode.tsx";
import { DeviceHubProvider, useDeviceHub } from "../src/lib/device-hub.tsx";

function SignedInTree({ children }: { children: ReactNode }) {
	const { setTab } = useDeviceHub();
	return (
		<BoardSelectionProvider onOpenT3={() => setTab("t3")}>
			<ApiCacheProvider>{children}</ApiCacheProvider>
		</BoardSelectionProvider>
	);
}

function RootStack() {
	const { isDark } = useColorMode();
	return (
		<>
			<StatusBar style={isDark ? "light" : "dark"} />
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen
					name="auth/callback"
					options={{ headerShown: true, title: "Sign in" }}
				/>
			</Stack>
		</>
	);
}

export default function Layout() {
	return (
		<ColorModeProvider>
			<AuthProvider>
				<DeviceHubProvider>
					<SignedInTree>
						<RootStack />
					</SignedInTree>
				</DeviceHubProvider>
			</AuthProvider>
		</ColorModeProvider>
	);
}
