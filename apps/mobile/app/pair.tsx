import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { claimDevice, signCredentials } from "../src/lib/api.ts";
import { useAuth } from "../src/lib/auth.tsx";
import {
	createBoardLoss,
	ensureBluetoothOn,
	openBoardSession,
	readInfo,
	scanBoard,
	sendEnvelope,
} from "../src/lib/ble.ts";
import { colors } from "../src/lib/theme.ts";

export default function PairScreen() {
	const auth = useAuth();
	const [status, setStatus] = useState("Ready to scan");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [paired, setPaired] = useState(false);

	async function pair() {
		if (busy) {
			return;
		}
		if (!auth.token) {
			setError("sign in first");
			return;
		}
		setBusy(true);
		setPaired(false);
		setError("");
		try {
			await ensureBluetoothOn();
			setStatus("Scanning…");
			const device = await scanBoard();
			const loss = createBoardLoss();
			setStatus("Connecting…");
			const session = await openBoardSession(device, (why) => loss.lose(why));
			try {
				setStatus("Reading board…");
				const info = await readInfo(session.device);
				setStatus("Signing credentials…");
				const envelope = await signCredentials(auth.token);
				setStatus("Asking board for pairing key…");
				const raw = await sendEnvelope(session.device, envelope, loss);
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
				setPaired(true);
			} finally {
				await session.close();
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "pair failed");
			setStatus("Ready to scan");
		} finally {
			setBusy(false);
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
			{busy ? <ActivityIndicator /> : null}
			{paired ? (
				<Link href="/" asChild>
					<Pressable style={styles.secondary}>
						<Text style={styles.secondaryLabel}>Back to devices</Text>
					</Pressable>
				</Link>
			) : null}
			<Pressable
				style={[styles.button, busy ? styles.buttonDisabled : null]}
				disabled={busy}
				onPress={() => void pair()}
			>
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
	buttonDisabled: { opacity: 0.6 },
	buttonLabel: { color: "#fff", fontWeight: "600" },
	secondary: { padding: 14, alignItems: "center" },
	secondaryLabel: { color: colors.primary, fontWeight: "600" },
});
