import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { claimDevice, signCredentials } from "../src/lib/api.ts";
import { useAuth } from "../src/lib/auth.tsx";
import { readInfo, scanBoard, sendEnvelope } from "../src/lib/ble.ts";
import { colors } from "../src/lib/theme.ts";

export default function PairScreen() {
	const auth = useAuth();
	const [status, setStatus] = useState("Ready to scan");
	const [error, setError] = useState("");

	async function pair() {
		if (!auth.token) {
			setError("sign in first");
			return;
		}
		setError("");
		try {
			setStatus("Scanning…");
			const device = await scanBoard();
			setStatus("Reading board…");
			const info = await readInfo(device);
			setStatus("Signing credentials…");
			const envelope = await signCredentials(auth.token);
			setStatus("Asking board for pairing key…");
			const raw = await sendEnvelope(device, envelope);
			const creds = JSON.parse(raw) as {
				uuid?: string;
				key?: string;
				deviceUrl?: string;
			};
			if (!creds.uuid || !creds.key) {
				throw new Error("device did not return pairing credentials");
			}
			setStatus("Claiming…");
			await claimDevice(auth.token, {
				uuid: creds.uuid,
				key: creds.key,
				deviceUrl: creds.deviceUrl || info.deviceUrl,
			});
			setStatus("Paired");
			await device.cancelConnection();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "pair failed");
		}
	}

	return (
		<View style={styles.page}>
			<Text style={styles.title}>Pair a board</Text>
			<Text style={styles.muted}>
				Uses the same BLE service as the web dashboard. The dashboard signs the
				request; this app only writes the envelope over GATT.
			</Text>
			<Text>{status}</Text>
			{error ? <Text style={styles.error}>{error}</Text> : null}
			<Pressable style={styles.button} onPress={() => void pair()}>
				<Text style={styles.buttonLabel}>Scan gpio-companion</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
	title: { fontSize: 22, fontWeight: "600", color: colors.text },
	muted: { color: colors.muted },
	error: { color: colors.danger },
	button: {
		backgroundColor: colors.primary,
		padding: 14,
		borderRadius: 999,
		alignItems: "center",
	},
	buttonLabel: { color: "#fff", fontWeight: "600" },
});
