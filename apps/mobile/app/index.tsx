import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Linking,
	Platform,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import {
	listDebugBoards,
	loadDeviceLogs,
	type MaintenanceReport,
	t3Action,
	unpairDevice,
} from "../src/lib/api.ts";
import { useAuth } from "../src/lib/auth.tsx";
import { dashboardUrl } from "../src/lib/config.ts";
import { useUserDevices } from "../src/lib/device-cache.tsx";
import { colors } from "../src/lib/theme.ts";

export default function DevicesScreen() {
	const auth = useAuth();
	const { devices, error: loadError, refetch, removeDevice } = useUserDevices();
	const [error, setError] = useState("");
	const [refreshing, setRefreshing] = useState(false);
	const [t3Busy, setT3Busy] = useState("");
	const [logBusy, setLogBusy] = useState("");
	const [maintenance, setMaintenance] = useState<
		Record<string, MaintenanceReport | null>
	>({});

	const loadMaintenance = useCallback(async () => {
		if (!auth.token) {
			setMaintenance({});
			return;
		}
		const debug = await listDebugBoards(auth.token);
		const next: Record<string, MaintenanceReport | null> = {};
		for (const board of debug.devices) {
			next[board.uuid] = board.maintenance ?? null;
		}
		setMaintenance(next);
	}, [auth.token]);

	useEffect(() => {
		void loadMaintenance().catch(() => undefined);
	}, [loadMaintenance]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await refetch({ force: true });
			await loadMaintenance().catch(() => undefined);
			setError("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "load failed");
		} finally {
			setRefreshing(false);
		}
	}, [refetch, loadMaintenance]);

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
			{error || loadError ? (
				<Text style={styles.error}>{error || loadError}</Text>
			) : null}
			<FlatList
				data={devices}
				keyExtractor={(item) => item.uuid}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
					/>
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
						{maintenance[item.uuid]?.diskAvailMb != null &&
						maintenance[item.uuid]?.diskTotalMb ? (
							<Text style={styles.muted}>
								{maintenance[item.uuid]?.diskAvailMb} MB free of{" "}
								{maintenance[item.uuid]?.diskTotalMb} MB
								{maintenance[item.uuid]?.reclaimedBytes
									? ` · cleaned ${maintenance[item.uuid]?.reclaimedBytes} B`
									: ""}
							</Text>
						) : null}
						<Pressable
							disabled={logBusy === item.uuid || !auth.token}
							onPress={() => {
								if (!auth.token) {
									return;
								}
								setLogBusy(item.uuid);
								void loadDeviceLogs(auth.token, item.uuid)
									.then((result) => {
										Alert.alert(
											"Last 24h logs",
											result.text.trim() ||
												"No journal lines in the last 24 hours.",
										);
										setError("");
									})
									.catch((caught) => {
										setError(
											caught instanceof Error ? caught.message : "logs failed",
										);
									})
									.finally(() => setLogBusy(""));
							}}
						>
							<Text style={styles.primaryLink}>
								{logBusy === item.uuid ? "Loading logs…" : "Last 24h logs"}
							</Text>
						</Pressable>
						<Pressable
							disabled={t3Busy === item.uuid || !auth.token}
							onPress={() => {
								if (!auth.token) {
									return;
								}
								setT3Busy(item.uuid);
								void t3Action(auth.token, "pair", item.uuid)
									.then((result) => {
										const token =
											result.pairingToken?.trim() ||
											result.pairingUrl?.match(/[#?&]token=([^&\s#]+)/)?.[1] ||
											"";
										const decoded = (() => {
											try {
												return decodeURIComponent(token);
											} catch {
												return token;
											}
										})();
										const url = `${dashboardUrl}/devices/t3?uuid=${encodeURIComponent(item.uuid)}#token=${encodeURIComponent(decoded)}`;
										Alert.alert(
											"T3 pairing",
											decoded ? `Pair code: ${decoded}` : "Pairing link ready",
											[
												{
													text: "Open dashboard",
													onPress: () => void Linking.openURL(url),
												},
												{ text: "OK" },
											],
										);
										setError("");
									})
									.catch((caught) => {
										setError(
											caught instanceof Error
												? caught.message
												: "T3 pair failed",
										);
									})
									.finally(() => setT3Busy(""));
							}}
						>
							<Text style={styles.primaryLink}>
								{t3Busy === item.uuid
									? "Minting T3 link…"
									: "New T3 pairing link"}
							</Text>
						</Pressable>
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
													removeDevice(item.uuid);
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
	primaryLink: { color: colors.primary, marginTop: 8 },
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
