import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/lib/auth.tsx";
import { DeviceCacheProvider } from "../src/lib/device-cache.tsx";

export default function Layout() {
	return (
		<AuthProvider>
			<DeviceCacheProvider>
				<StatusBar style="auto" />
				<Stack
					screenOptions={{
						headerTitle: "gpio-companion",
					}}
				/>
			</DeviceCacheProvider>
		</AuthProvider>
	);
}
