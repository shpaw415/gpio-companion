import { useState } from "react";
import { ActivityIndicator, Clipboard, Text, View } from "react-native";
import {
	signDeviceInfo,
	signFlash,
	signGpio,
	signRun,
	signWifi,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { sendEnvelope } from "../lib/ble.ts";
import {
	BLE_HEALTH_CHECKS,
	BLE_HEALTH_WIFI_PSK,
	BLE_HEALTH_WIFI_SSID,
	type BleHealthCheckId,
	evaluateBleHealthCheck,
	formatBleHealthReport,
	parseBleHealthBody,
} from "../lib/ble-health.ts";
import { useColors } from "../lib/color-mode.tsx";
import { openPairedBoard } from "../lib/paired-ble.ts";
import { Body, Muted, TextButton } from "./ui.tsx";

type RowState = "idle" | "running" | "pass" | "fail" | "skipped";

type Row = {
	id: BleHealthCheckId;
	name: string;
	state: RowState;
	log: string;
};

function emptyRows(): Row[] {
	return BLE_HEALTH_CHECKS.map((check) => ({
		id: check.id,
		name: check.name,
		state: "idle",
		log: "",
	}));
}

export default function BleHealthRunner({ uuid }: { uuid: string }) {
	const auth = useAuth();
	const colors = useColors();
	const [rows, setRows] = useState<Row[]>(emptyRows);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const hasResults = rows.some((row) => row.state !== "idle");

	function patch(id: BleHealthCheckId, next: Partial<Row>) {
		setRows((current) =>
			current.map((row) => (row.id === id ? { ...row, ...next } : row)),
		);
	}

	async function copyResults() {
		const text = formatBleHealthReport(rows);
		if (!text) {
			return;
		}
		Clipboard.setString(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	function skipRest(failedId: BleHealthCheckId, reason: string) {
		setRows((current) =>
			current.map((row) => {
				if (row.id === failedId || row.state !== "idle") {
					return row;
				}
				return { ...row, state: "skipped", log: `Skipped: ${reason}` };
			}),
		);
	}

	async function run() {
		if (!uuid || busy || !auth.token) {
			return;
		}
		const token = auth.token;
		setBusy(true);
		setRows(emptyRows());
		let session: Awaited<ReturnType<typeof openPairedBoard>>["session"] | null =
			null;
		let loss: Awaited<ReturnType<typeof openPairedBoard>>["loss"] | null = null;
		try {
			patch("gatt-info", { state: "running", log: "" });
			try {
				const paired = await openPairedBoard(uuid, { token });
				session = paired.session;
				loss = paired.loss;
				const verdict = evaluateBleHealthCheck("gatt-info", {
					selectedUuid: uuid,
					body: paired.info,
				});
				patch("gatt-info", {
					state: verdict.pass ? "pass" : "fail",
					log: verdict.pass ? "" : verdict.detail,
				});
				if (!verdict.pass) {
					skipRest("gatt-info", verdict.detail);
					return;
				}
			} catch (caught) {
				const verdict = evaluateBleHealthCheck("gatt-info", {
					error: caught instanceof Error ? caught.message : "connect failed",
				});
				patch("gatt-info", { state: "fail", log: verdict.detail });
				skipRest("gatt-info", verdict.detail);
				return;
			}
			if (!session || !loss) {
				return;
			}
			for (const check of BLE_HEALTH_CHECKS) {
				if (check.id === "gatt-info") {
					continue;
				}
				patch(check.id, { state: "running", log: "" });
				try {
					const envelope = await signCheck(token, uuid, check.id);
					const raw = await sendEnvelope(session.device, envelope, loss);
					const verdict = evaluateBleHealthCheck(check.id, {
						selectedUuid: uuid,
						body: parseBleHealthBody(raw),
					});
					patch(check.id, {
						state: verdict.pass ? "pass" : "fail",
						log: verdict.pass ? "" : verdict.detail,
					});
				} catch (caught) {
					const verdict = evaluateBleHealthCheck(check.id, {
						error:
							caught instanceof Error
								? caught.message
								: "bluetooth test failed",
					});
					patch(check.id, {
						state: verdict.pass ? "pass" : "fail",
						log: verdict.pass ? "" : verdict.detail,
					});
				}
			}
		} finally {
			await session?.close();
			setBusy(false);
		}
	}

	return (
		<View style={{ gap: 8, marginTop: 8 }}>
			<Body>Bluetooth endpoints</Body>
			<Muted>
				Runtime healthcheck of GATT info plus each companion route the Pi
				accepts over Bluetooth. WiFi uses a probe SSID that should not exist.
				GPIO write targets physical pin 1 (power) and must be refused.
			</Muted>
			<TextButton
				label={busy ? "Testing…" : "Test Bluetooth"}
				disabled={!uuid || busy || !auth.token}
				onPress={() => void run()}
			/>
			<TextButton
				label={copied ? "Copied" : "Copy results"}
				disabled={!hasResults}
				onPress={() => void copyResults()}
			/>
			{rows.map((row) => (
				<View key={row.id} style={{ gap: 4 }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 8,
							flexWrap: "wrap",
						}}
					>
						<StatusMark state={row.state} />
						<Text style={{ color: colors.text }}>{row.name}</Text>
					</View>
					{row.log ? (
						<Text
							selectable
							style={{
								color: colors.danger,
								fontFamily: "monospace",
								fontSize: 12,
								paddingLeft: 24,
							}}
						>
							{row.log}
						</Text>
					) : null}
				</View>
			))}
		</View>
	);
}

function StatusMark({ state }: { state: RowState }) {
	const colors = useColors();
	if (state === "running") {
		return <ActivityIndicator size="small" />;
	}
	const mark =
		state === "pass"
			? "✓"
			: state === "fail"
				? "✕"
				: state === "skipped"
					? "–"
					: "○";
	const color =
		state === "pass"
			? colors.success
			: state === "fail"
				? colors.danger
				: colors.muted;
	return <Text style={{ color, fontSize: 16 }}>{mark}</Text>;
}

async function signCheck(token: string, uuid: string, id: BleHealthCheckId) {
	switch (id) {
		case "get-info":
			return signDeviceInfo(token, uuid);
		case "get-gpio":
			return signGpio(token, { uuid });
		case "put-gpio-power":
			return signGpio(token, { uuid, physical: 1, dir: "out", value: 0 });
		case "get-flash":
			return signFlash(token, { uuid });
		case "get-flash-ports":
			return signFlash(token, { uuid, ports: true });
		case "get-run":
			return signRun(token, { uuid });
		case "put-wifi":
			return signWifi(token, {
				uuid,
				ssid: BLE_HEALTH_WIFI_SSID,
				psk: BLE_HEALTH_WIFI_PSK,
			});
		default:
			throw new Error(`no signer for ${id}`);
	}
}
