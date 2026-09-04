import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { deviceDisplayName, signWifi } from "../lib/api.ts";
import { useUserBoards } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import {
	createBoardLoss,
	ensureBluetoothOn,
	openBoardSession,
	readInfo,
	scanNearby,
	scannedDevice,
	sendEnvelope,
	type NearbyRadio,
} from "../lib/ble.ts";
import { useColors } from "../lib/color-mode.tsx";
import { NearbyPicker } from "../components/NearbyPicker.tsx";
import {
	Busy,
	ErrorText,
	Field,
	Muted,
	PrimaryButton,
	Screen,
	TextButton,
	Title,
} from "../components/ui.tsx";

export default function Wifi() {
	const auth = useAuth();
	const colors = useColors();
	const { uuid: selectedUuid, setUuid } = useBoardSelection();
	const { devices, error: loadError } = useUserBoards();
	const [uuid, setLocalUuid] = useState(selectedUuid);
	const [boardId, setBoardId] = useState("");
	const [boards, setBoards] = useState<NearbyRadio[]>([]);
	const [ssid, setSsid] = useState("");
	const [psk, setPsk] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [scanning, setScanning] = useState(false);
	const scanRef = useRef(0);

	useEffect(() => {
		setLocalUuid((current) => {
			if (devices.some((board) => board.uuid === current)) {
				return current;
			}
			return selectedUuid || devices[0]?.uuid || "";
		});
	}, [devices, selectedUuid]);

	const scan = useCallback(async () => {
		const generation = ++scanRef.current;
		setScanning(true);
		setError("");
		setStatus("Scanning nearby Bluetooth…");
		try {
			await ensureBluetoothOn();
			const next = await scanNearby();
			if (scanRef.current !== generation) {
				return;
			}
			setBoards(next);
			const pick = next.find((board) => board.matched)?.id ?? next[0]?.id ?? "";
			setBoardId(pick);
			setStatus(
				next.length === 0
					? "No nearby devices — move closer and scan again"
					: `Found ${next.length} nearby`,
			);
		} catch (caught) {
			if (scanRef.current !== generation) {
				return;
			}
			setError(caught instanceof Error ? caught.message : "scan failed");
			setStatus("");
		} finally {
			if (scanRef.current === generation) {
				setScanning(false);
			}
		}
	}, []);

	useEffect(() => {
		void scan();
	}, [scan]);

	async function send() {
		if (busy || scanning) {
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
		if (!boardId) {
			setError("select a nearby Bluetooth device first");
			return;
		}
		const bleDevice = scannedDevice(boardId);
		if (!bleDevice) {
			setError("scan again and pick the board");
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
			const loss = createBoardLoss();
			setStatus("Connecting…");
			const session = await openBoardSession(bleDevice, (why) => loss.lose(why));
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
		<Screen>
			<Title>WiFi over Bluetooth</Title>
			<Muted>
				Pick the Pi in Nearby Bluetooth device, then send the network name and password.
			</Muted>
			<Muted>Paired board</Muted>
			{devices.length === 0 ? (
				<Muted>No paired boards yet. Pair one first.</Muted>
			) : (
				<View style={{ gap: 8 }}>
					{devices.map((board) => {
						const selected = board.uuid === uuid;
						return (
							<Pressable
								key={board.uuid}
								onPress={() => {
									setLocalUuid(board.uuid);
									setUuid(board.uuid);
								}}
								style={{
									backgroundColor: colors.surface,
									borderRadius: 12,
									padding: 12,
									borderWidth: 1,
									borderColor: selected ? colors.primary : colors.border,
								}}
							>
								<Text
									style={{
										color: selected ? colors.primary : colors.text,
										fontWeight: selected ? "600" : "400",
									}}
								>
									{deviceDisplayName(board)}
								</Text>
							</Pressable>
						);
					})}
				</View>
			)}
			<NearbyPicker
				boards={boards}
				selectedId={boardId}
				onSelect={setBoardId}
				scanning={scanning}
				disabled={busy}
			/>
			<TextButton
				label="Scan nearby"
				disabled={scanning || busy}
				onPress={() => void scan()}
			/>
			<Field label="Network name" value={ssid} onChangeText={setSsid} placeholder="SSID" />
			<Field
				label="Password"
				value={psk}
				onChangeText={setPsk}
				placeholder="WiFi password"
				secure={!showPassword}
			/>
			<TextButton
				label={showPassword ? "Hide password" : "Show password"}
				onPress={() => setShowPassword((current) => !current)}
			/>
			{status ? <Muted>{status}</Muted> : null}
			<ErrorText>{error || loadError}</ErrorText>
			<Busy show={busy || scanning} />
			<PrimaryButton
				label="Send to board"
				disabled={busy || scanning || !uuid || !boardId}
				onPress={() => void send()}
			/>
		</Screen>
	);
}
