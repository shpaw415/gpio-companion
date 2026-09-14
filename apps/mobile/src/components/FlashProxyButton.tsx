import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
	type ArduinoProxyStatus,
	type FlashPort,
	loadArduinoProxy,
	loadFlashPorts,
	startFlashProxy,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { useDeviceHub } from "../lib/use-device-hub.ts";
import { Body, Chip, ErrorText, Muted, TextButton } from "./ui.tsx";

const PROXY_BOARDS = [
	{ fqbn: "arduino:avr:uno", name: "Arduino Uno" },
	{ fqbn: "arduino:avr:nano", name: "Arduino Nano" },
	{ fqbn: "arduino:avr:mega", name: "Arduino Mega 2560" },
	{ fqbn: "arduino:samd:nano_33_iot", name: "Arduino Nano 33 IoT" },
	{ fqbn: "arduino:samd:mkrwifi1010", name: "Arduino MKR WiFi 1010" },
	{ fqbn: "arduino:samd:mkrzero", name: "Arduino MKR Zero" },
	{ fqbn: "arduino:samd:mzero", name: "Arduino Zero" },
	{ fqbn: "esp32:esp32:esp32", name: "ESP32 Dev Module" },
	{ fqbn: "esp32:esp32:esp32s3", name: "ESP32-S3" },
	{ fqbn: "esp32:esp32:esp32c3", name: "ESP32-C3" },
] as const;

function isProxyFqbn(fqbn: string): boolean {
	const trimmed = fqbn.trim();
	const normalized = trimmed.startsWith("arduino:avr:mega")
		? "arduino:avr:mega"
		: trimmed;
	return PROXY_BOARDS.some(
		(board) =>
			board.fqbn === normalized || trimmed.startsWith(`${board.fqbn}:`),
	);
}

export default function FlashProxyButton({
	uuid,
	connected,
}: {
	uuid: string;
	connected?: boolean;
}) {
	const auth = useAuth();
	const token = auth.token;
	const colors = useColors();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [ports, setPorts] = useState<FlashPort[]>([]);
	const [port, setPort] = useState("");
	const [fqbn, setFqbn] = useState("arduino:avr:uno");
	const [proxy, setProxy] = useState<ArduinoProxyStatus | null>(null);

	const load = useCallback(async () => {
		if (!uuid || !token || connected === false) {
			setPorts([]);
			setProxy(null);
			return;
		}
		const listed = await loadFlashPorts(token, uuid);
		setPorts(listed.ports);
		const first = listed.ports.find((item) =>
			item.fqbn ? isProxyFqbn(item.fqbn) : true,
		);
		if (first?.address) {
			setPort(first.address);
		}
		if (first?.fqbn && isProxyFqbn(first.fqbn)) {
			setFqbn(first.fqbn);
		}
		try {
			setProxy(await loadArduinoProxy(token, uuid));
		} catch {
			setProxy(null);
		}
	}, [uuid, token, connected]);

	useEffect(() => {
		void load().catch(() => undefined);
	}, [load]);

	useDeviceHub(uuid, token, {
		onArduinoProxy: (status) => setProxy(status),
	});

	if (connected === false) {
		return null;
	}

	const live = Boolean(proxy?.connected);
	const hasBoard = ports.length > 0 || live;

	if (!hasBoard) {
		return null;
	}

	return (
		<View style={{ gap: 8 }}>
			<Body>Arduino proxy</Body>
			<Chip
				label={
					live
						? `Firmata · ${proxy?.name || proxy?.fqbn || "connected"}`
						: "USB Arduino"
				}
				tone={live ? "success" : "muted"}
			/>
			<Muted>
				Flash the companion slave firmware so Live GPIO and Run on board can
				drive every pin over USB. Uno/Mega are 5V; SAMD/ESP32 are 3.3V.
			</Muted>
			{ports.length > 1
				? ports.map((item) => (
						<Pressable
							key={item.address}
							onPress={() => setPort(item.address)}
							style={{
								borderWidth: 1,
								borderColor:
									port === item.address ? colors.primary : colors.border,
								borderRadius: 8,
								paddingHorizontal: 10,
								paddingVertical: 8,
							}}
						>
							<Text
								style={{
									color: port === item.address ? colors.primary : colors.text,
								}}
							>
								{item.name || item.address}
							</Text>
						</Pressable>
					))
				: null}
			{PROXY_BOARDS.map((board) => (
				<Pressable
					key={board.fqbn}
					onPress={() => setFqbn(board.fqbn)}
					style={{
						borderWidth: 1,
						borderColor: fqbn === board.fqbn ? colors.primary : colors.border,
						borderRadius: 8,
						paddingHorizontal: 10,
						paddingVertical: 8,
					}}
				>
					<Text
						style={{
							color: fqbn === board.fqbn ? colors.primary : colors.text,
						}}
					>
						{board.name}
					</Text>
				</Pressable>
			))}
			{error ? <ErrorText>{error}</ErrorText> : null}
			<TextButton
				label={
					busy
						? "Flashing…"
						: live
							? "Re-flash Arduino as proxy"
							: "Flash Arduino as proxy"
				}
				disabled={busy || !uuid || !token}
				onPress={() => {
					if (!token) {
						return;
					}
					setBusy(true);
					setError("");
					void startFlashProxy(token, {
						uuid,
						fqbn,
						port: port || undefined,
					})
						.catch((caught) => {
							setError(
								caught instanceof Error ? caught.message : "flash failed",
							);
						})
						.finally(() => setBusy(false));
				}}
			/>
		</View>
	);
}
