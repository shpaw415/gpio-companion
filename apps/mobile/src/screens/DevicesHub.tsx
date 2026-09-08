import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import T3WebView from "../components/T3WebView.tsx";
import { Paper, PrimaryButton, Title } from "../components/ui.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { deviceTabs } from "../lib/dashboard-mode.ts";
import { useDashboardMode } from "../lib/dashboard-mode.tsx";
import { useDeviceHub } from "../lib/device-hub.tsx";
import Admin from "./Admin.tsx";
import Debug from "./Debug.tsx";
import Docs from "./Docs.tsx";
import Overview from "./Overview.tsx";
import Pair from "./Pair.tsx";
import Requests from "./Requests.tsx";
import T3 from "./T3.tsx";
import Wifi from "./Wifi.tsx";

export default function DevicesHub() {
	const colors = useColors();
	const auth = useAuth();
	const { tab, setTab } = useDeviceHub();
	const { mode, isEasy, setMode } = useDashboardMode();
	const admin = auth.session?.role === "admin";
	const tabs = deviceTabs(mode, admin);
	const onT3 = tab === "t3";
	const allowed = tabs.some((item) => item.id === tab);
	const expertOnly = tab === "debug" || tab === "admin";

	useEffect(() => {
		if (!allowed) {
			setTab("overview");
		}
	}, [allowed, setTab]);

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
				{isEasy && expertOnly ? (
					<Paper>
						<Title>Expert mode</Title>
						<PrimaryButton
							label="Switch to Expert"
							onPress={() => setMode("expert")}
						/>
					</Paper>
				) : (
					<>
						{tab === "overview" ? <Overview /> : null}
						{tab === "docs" ? <Docs /> : null}
						{onT3 ? <T3 /> : null}
						{tab === "pair" ? <Pair /> : null}
						{tab === "wifi" ? <Wifi /> : null}
						{tab === "requests" ? <Requests /> : null}
						{tab === "debug" ? <Debug /> : null}
						{tab === "admin" && admin ? <Admin /> : null}
					</>
				)}
				<T3WebView visible={onT3} />
			</View>
		</View>
	);
}
