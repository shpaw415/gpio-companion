import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/lib/auth.tsx";

export default function Layout() {
	return (
		<AuthProvider>
			<StatusBar style="auto" />
			<Stack
				screenOptions={{
					headerTitle: "gpio-companion",
				}}
			/>
		</AuthProvider>
	);
}
