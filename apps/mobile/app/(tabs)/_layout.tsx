import { Tabs } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Deck from "../../src/components/Deck.tsx";
import Login from "../../src/components/Login.tsx";
import { useAuth } from "../../src/lib/auth.tsx";

export default function TabsLayout() {
	const auth = useAuth();

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
						tabBarStyle: { display: "none" },
					}}
				>
					<Tabs.Screen name="project" />
					<Tabs.Screen name="index" />
					<Tabs.Screen name="profile" />
				</Tabs>
			</Deck>
		</KeyboardAvoidingView>
	);
}
