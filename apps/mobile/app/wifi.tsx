import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { listDevices, signWifi } from "../src/lib/api.ts";
import { useAuth } from "../src/lib/auth.tsx";
import { readInfo, scanBoard, sendEnvelope } from "../src/lib/ble.ts";
import { colors } from "../src/lib/theme.ts";

export default function WifiScreen() {
	const auth = useAuth();
	const [uuid, setUuid] = useState("");
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!auth.token) {
			return;
		}
		void listDevices(auth.token).then((result) => {
			setUuid(result.devices.at(-1)?.uuid ?? "");
		});
	}, [auth.token]);

	async function send() {
		if (!auth.token) {
			setError("sign in first");
			return;
		}
		setError("");
		try {
			setStatus("Signing WiFi…");
			const envelope = await signWifi(auth.token, { uuid, ssid, psk });
			setStatus("Scanning…");
			const device = await scanBoard();
			await readInfo(device);
			setStatus("Writing…");
			const raw = await sendEnvelope(device, envelope);
			setStatus(raw || "sent");
			await device.cancelConnection();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "wifi failed");
		}
	}

	return (
		<View style={styles.page}>
			<Text style={styles.title}>WiFi over Bluetooth</Text>
			<TextInput
				style={styles.input}
				value={uuid}
				onChangeText={setUuid}
				placeholder="Paired UUID"
				autoCapitalize="none"
			/>
			<TextInput
				style={styles.input}
				value={ssid}
				onChangeText={setSsid}
				placeholder="SSID"
				autoCapitalize="none"
			/>
			<TextInput
				style={styles.input}
				value={psk}
				onChangeText={setPsk}
				placeholder="Password"
				secureTextEntry
			/>
			<Text>{status}</Text>
			{error ? <Text style={styles.error}>{error}</Text> : null}
			<Pressable style={styles.button} onPress={() => void send()}>
				<Text style={styles.buttonLabel}>Send to board</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
	title: { fontSize: 22, fontWeight: "600", color: colors.text },
	error: { color: colors.danger },
	input: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: 12,
		color: colors.text,
	},
	button: {
		backgroundColor: colors.primary,
		padding: 14,
		borderRadius: 999,
		alignItems: "center",
	},
	buttonLabel: { color: "#fff", fontWeight: "600" },
});
