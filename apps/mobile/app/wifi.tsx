import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { listDevices, signWifi } from "../src/lib/api.ts";
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

type BoardDevice = {
	uuid: string;
	login: string;
	label?: string;
};

export default function WifiScreen() {
	const auth = useAuth();
	const [devices, setDevices] = useState<BoardDevice[]>([]);
	const [uuid, setUuid] = useState("");
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!auth.token) {
			return;
		}
		void listDevices(auth.token)
			.then((result) => {
				setDevices(result.devices);
				setUuid((current) => {
					if (result.devices.some((board) => board.uuid === current)) {
						return current;
					}
					return result.devices[0]?.uuid ?? "";
				});
			})
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "load failed");
			});
	}, [auth.token]);

	async function send() {
		if (busy) {
			return;
		}
		if (!auth.token) {
			setError("sign in first");
			return;
		}
		if (!uuid) {
			setError("choose a paired board first");
			return;
		}
		if (!ssid.trim()) {
			setError("enter the wifi network name");
			return;
		}
		if (psk.length < 8) {
			setError("wifi password must be at least 8 characters");
			return;
		}
		setBusy(true);
		setError("");
		try {
			await ensureBluetoothOn();
			setStatus("Scanning…");
			const device = await scanBoard();
			const loss = createBoardLoss();
			setStatus("Connecting…");
			const session = await openBoardSession(device, (why) => loss.lose(why));
			try {
				await readInfo(session.device);
				setStatus("Signing WiFi…");
				const envelope = await signWifi(auth.token, {
					uuid,
					ssid: ssid.trim(),
					psk,
				});
				setStatus("Writing…");
				const raw = await sendEnvelope(session.device, envelope, loss);
				setStatus(raw || "sent");
			} finally {
				await session.close();
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "wifi failed");
			setStatus("");
		} finally {
			setBusy(false);
		}
	}

	return (
		<View style={styles.page}>
			<Text style={styles.title}>WiFi over Bluetooth</Text>
			{devices.length === 0 ? (
				<Text style={styles.muted}>No paired boards yet. Pair one first.</Text>
			) : (
				<View style={styles.picker}>
					{devices.map((board) => {
						const selected = board.uuid === uuid;
						return (
							<Pressable
								key={board.uuid}
								style={[styles.option, selected ? styles.optionSelected : null]}
								onPress={() => setUuid(board.uuid)}
							>
								<Text
									style={[
										styles.optionLabel,
										selected ? styles.optionLabelSelected : null,
									]}
								>
									{board.label?.trim() || board.uuid}
								</Text>
							</Pressable>
						);
					})}
				</View>
			)}
			<TextInput
				style={styles.input}
				value={ssid}
				onChangeText={setSsid}
				placeholder="SSID"
				autoCapitalize="none"
				autoCorrect={false}
			/>
			<TextInput
				style={styles.input}
				value={psk}
				onChangeText={setPsk}
				placeholder="Password"
				secureTextEntry
				autoCapitalize="none"
				autoCorrect={false}
			/>
			<Text>{status}</Text>
			{error ? <Text style={styles.error}>{error}</Text> : null}
			{busy ? <ActivityIndicator /> : null}
			<Pressable
				style={[styles.button, busy ? styles.buttonDisabled : null]}
				disabled={busy}
				onPress={() => void send()}
			>
				<Text style={styles.buttonLabel}>Send to board</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
	title: { fontSize: 22, fontWeight: "600", color: colors.text },
	muted: { color: colors.muted },
	error: { color: colors.danger },
	picker: { gap: 8 },
	option: {
		backgroundColor: colors.surface,
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: "transparent",
	},
	optionSelected: { borderColor: colors.primary },
	optionLabel: { color: colors.text },
	optionLabelSelected: { color: colors.primary, fontWeight: "600" },
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
	buttonDisabled: { opacity: 0.6 },
	buttonLabel: { color: "#fff", fontWeight: "600" },
});
