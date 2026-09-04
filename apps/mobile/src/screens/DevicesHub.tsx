import { Pressable, ScrollView, Text, View } from "react-native";
import T3WebView from "../components/T3WebView.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { type DeviceTab, useDeviceHub } from "../lib/device-hub.tsx";
import Admin from "./Admin.tsx";
import Debug from "./Debug.tsx";
import Docs from "./Docs.tsx";
import Keys from "./Keys.tsx";
import Overview from "./Overview.tsx";
import Pair from "./Pair.tsx";
import Requests from "./Requests.tsx";
import T3 from "./T3.tsx";
import Wifi from "./Wifi.tsx";

const baseTabs: Array<{ id: DeviceTab; label: string }> = [
	{ id: "overview", label: "Overview" },
	{ id: "docs", label: "Docs" },
	{ id: "t3", label: "T3" },
	{ id: "pair", label: "Pair" },
	{ id: "wifi", label: "WiFi" },
	{ id: "keys", label: "Keys" },
	{ id: "requests", label: "Requests" },
	{ id: "debug", label: "Debug" },
];

export default function DevicesHub() {
	const colors = useColors();
	const auth = useAuth();
	const { tab, setTab } = useDeviceHub();
	const admin = auth.session?.role === "admin";
	const tabs = admin ? [...baseTabs, { id: "admin" as const, label: "Admin" }] : baseTabs;
	const onT3 = tab === "t3";

	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={{ flexGrow: 0, flexShrink: 0 }}
				contentContainerStyle={{
					paddingHorizontal: 8,
					gap: 4,
					paddingVertical: 8,
					alignItems: "center",
					flexGrow: 0,
				}}
			>
				{tabs.map((item) => {
					const active = tab === item.id;
					return (
						<Pressable
							key={item.id}
							onPress={() => setTab(item.id)}
							style={{
								paddingHorizontal: 12,
								paddingVertical: 8,
								borderRadius: 999,
								backgroundColor: active ? colors.chipBg : "transparent",
							}}
						>
							<Text
								style={{
									color: active ? colors.primary : colors.muted,
									fontWeight: active ? "700" : "500",
								}}
							>
								{item.label}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
			<View style={{ flex: 1, minHeight: 0 }}>
				{tab === "overview" ? <Overview /> : null}
				{tab === "docs" ? <Docs /> : null}
				{onT3 ? <T3 /> : null}
				{tab === "pair" ? <Pair /> : null}
				{tab === "wifi" ? <Wifi /> : null}
				{tab === "keys" ? <Keys /> : null}
				{tab === "requests" ? <Requests /> : null}
				{tab === "debug" ? <Debug /> : null}
				{tab === "admin" && admin ? <Admin /> : null}
				<T3WebView visible={onT3} />
			</View>
		</View>
	);
}
