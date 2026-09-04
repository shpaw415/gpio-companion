import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Platform,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { listDevices, unpairDevice } from "../src/lib/api.ts";
import { useAuth } from "../src/lib/auth.tsx";
import { colors } from "../src/lib/theme.ts";

type BoardDevice = {
	uuid: string;
	deviceUrl: string;
	login: string;
	label?: string;
};

export default function DevicesScreen() {
	const auth = useAuth();
	const [devices, setDevices] = useState<BoardDevice[]>([]);
	const [error, setError] = useState("");
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(async () => {
		if (!auth.token) {
			return;
		}
		try {
			const result = await listDevices(auth.token);
			setDevices(result.devices);
			setError("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "load failed");
		}
	}, [auth.token]);

	useEffect(() => {
		void load();
	}, [load]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	if (!auth.ready) {
		return (
			<View style={styles.center}>
				<ActivityIndicator />
			</View>
		);
	}

	if (!auth.token) {
		return (
			<View style={styles.center}>
				<Text style={styles.title}>Sign in with GitHub</Text>
				<Text style={styles.muted}>
					Pair a board over Bluetooth. Project, Keys, and Credits stay on the
					web dashboard.
				</Text>
				{auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
				<Pressable style={styles.button} onPress={() => void auth.login()}>
					<Text style={styles.buttonLabel}>Continue with GitHub</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={styles.page}>
			<Text style={styles.title}>Devices</Text>
			{error ? <Text style={styles.error}>{error}</Text> : null}
			<FlatList
				data={devices}
				keyExtractor={(item) => item.uuid}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
				}
				ListEmptyComponent={
					<Text style={styles.muted}>No boards yet. Pair one nearby.</Text>
				}
				renderItem={({ item }) => (
					<View style={styles.card}>
						<Text style={styles.cardTitle}>
							{item.label?.trim() || item.login || item.uuid}
						</Text>
						<Text style={styles.muted}>{item.uuid}</Text>
						<Pressable
							onPress={() => {
								Alert.alert("Unpair", "Remove this board from your account?", [
									{ text: "Cancel", style: "cancel" },
									{
										text: "Unpair",
										style: "destructive",
										onPress: () => {
											if (!auth.token) {
												return;
											}
											void unpairDevice(auth.token, item.uuid)
												.then(() => {
													setDevices((current) =>
														current.filter(
															(device) => device.uuid !== item.uuid,
														),
													);
													setError("");
												})
												.catch((caught) => {
													setError(
														caught instanceof Error
															? caught.message
															: "unpair failed",
													);
												});
										},
									},
								]);
							}}
						>
							<Text style={styles.danger}>Unpair</Text>
						</Pressable>
					</View>
				)}
			/>
			<Link href="/pair" asChild>
				<Pressable style={styles.button}>
					<Text style={styles.buttonLabel}>Pair over Bluetooth</Text>
				</Pressable>
			</Link>
			<Link href="/wifi" asChild>
				<Pressable style={styles.secondary}>
					<Text style={styles.secondaryLabel}>Set WiFi</Text>
				</Pressable>
			</Link>
			<Pressable onPress={() => void auth.logout()}>
				<Text style={styles.muted}>Sign out</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
	center: {
		flex: 1,
		backgroundColor: colors.bg,
		padding: 24,
		justifyContent: "center",
		gap: 12,
	},
	title: { fontSize: 22, fontWeight: "600", color: colors.text },
	muted: { color: colors.muted },
	error: { color: colors.danger },
	danger: { color: colors.danger, marginTop: 8 },
	card: {
		backgroundColor: colors.surface,
		padding: 16,
		borderRadius: Platform.OS === "ios" ? 12 : 12,
		marginBottom: 12,
	},
	cardTitle: { fontWeight: "600", color: colors.text },
	button: {
		backgroundColor: colors.primary,
		padding: 14,
		borderRadius: 999,
		alignItems: "center",
	},
	buttonLabel: { color: "#fff", fontWeight: "600" },
	secondary: { padding: 14, alignItems: "center" },
	secondaryLabel: { color: colors.primary, fontWeight: "600" },
});
