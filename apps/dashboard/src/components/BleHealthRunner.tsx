import { POST as signFlash } from "@api/device/flash";
import { POST as signGpio } from "@api/device/gpio";
import { POST as signDeviceInfo } from "@api/device/info";
import { POST as signWifi } from "@api/wifi";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_HEALTH_CHECKS,
	BLE_HEALTH_WIFI_PSK,
	BLE_HEALTH_WIFI_SSID,
	type BleHealthCheckId,
	evaluateBleHealthCheck,
	parseBleHealthBody,
	type SignedDeviceEnvelope,
} from "gpio-companion";
import { useState } from "react";
import { unwrapAction } from "../lib/action.ts";
import {
	bluetoothChooserCancelled,
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";

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
	const supported = bluetoothSupported();
	const [rows, setRows] = useState<Row[]>(emptyRows);
	const [busy, setBusy] = useState(false);

	function patch(id: BleHealthCheckId, next: Partial<Row>) {
		setRows((current) =>
			current.map((row) => (row.id === id ? { ...row, ...next } : row)),
		);
	}

	async function run() {
		if (!uuid || busy) {
			return;
		}
		setBusy(true);
		setRows(emptyRows());
		let session: Awaited<ReturnType<typeof connectGpioCompanionBle>> | null =
			null;
		try {
			patch("gatt-info", { state: "running", log: "" });
			try {
				session = await connectGpioCompanionBle();
				const verdict = evaluateBleHealthCheck("gatt-info", {
					selectedUuid: uuid,
					body: session.info,
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
				if (bluetoothChooserCancelled(caught)) {
					patch("gatt-info", { state: "idle", log: "" });
					return;
				}
				const verdict = evaluateBleHealthCheck("gatt-info", {
					error: caught instanceof Error ? caught.message : "connect failed",
				});
				patch("gatt-info", { state: "fail", log: verdict.detail });
				skipRest("gatt-info", verdict.detail);
				return;
			}
			for (const check of BLE_HEALTH_CHECKS) {
				if (check.id === "gatt-info") {
					continue;
				}
				patch(check.id, { state: "running", log: "" });
				try {
					const envelope = await signCheck(uuid, check.id);
					const raw = await session.sendEnvelope(envelope);
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
			session?.disconnect();
			setBusy(false);
		}
	}

	function skipRest(failedId: BleHealthCheckId, reason: string) {
		setRows((current) =>
			current.map((row) => {
				if (row.id === failedId || row.state !== "idle") {
					return row;
				}
				return {
					...row,
					state: "skipped",
					log: `Skipped: ${reason}`,
				};
			}),
		);
	}

	return (
		<Stack spacing={1}>
			<Typography variant="subtitle1">Bluetooth endpoints</Typography>
			<Typography color="secondary" variant="body2">
				Runtime healthcheck of GATT info plus each companion route the Pi
				accepts over Bluetooth. WiFi uses a probe SSID that should not exist.
				GPIO write targets physical pin 1 (power) and must be refused.
			</Typography>
			{supported ? null : (
				<Alert severity="warning">
					Web Bluetooth is not available here. Use Chrome or Edge, or the native
					app.
				</Alert>
			)}
			<Button
				variant="outlined"
				disabled={!uuid || busy || !supported}
				onClick={() => void run()}
			>
				{busy ? "Testing…" : "Test Bluetooth"}
			</Button>
			<Stack spacing={1}>
				{rows.map((row) => (
					<Stack key={row.id} spacing={0.5}>
						<Stack
							direction="row"
							spacing={1}
							alignItems="center"
							className="flex-wrap"
						>
							<StatusMark state={row.state} />
							<Typography variant="body2">{row.name}</Typography>
						</Stack>
						{row.log ? (
							<Typography
								color="error"
								variant="body2"
								sx={{
									pl: 4,
									fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
									fontSize: 12,
									whiteSpace: "pre-wrap",
								}}
							>
								{row.log}
							</Typography>
						) : null}
					</Stack>
				))}
			</Stack>
		</Stack>
	);
}

function StatusMark({ state }: { state: RowState }) {
	if (state === "running") {
		return <CircularProgress size={16} />;
	}
	if (state === "pass") {
		return (
			<Typography color="success" variant="body2" aria-label="passed">
				✓
			</Typography>
		);
	}
	if (state === "fail") {
		return (
			<Typography color="error" variant="body2" aria-label="failed">
				✕
			</Typography>
		);
	}
	if (state === "skipped") {
		return (
			<Typography color="secondary" variant="body2" aria-label="skipped">
				–
			</Typography>
		);
	}
	return (
		<Typography color="secondary" variant="body2" aria-label="idle">
			○
		</Typography>
	);
}

async function signCheck(
	uuid: string,
	id: BleHealthCheckId,
): Promise<SignedDeviceEnvelope> {
	switch (id) {
		case "get-info":
			return unwrapAction(await signDeviceInfo(uuid));
		case "get-gpio":
			return unwrapAction(await signGpio({ uuid }));
		case "put-gpio-power":
			return unwrapAction(
				await signGpio({ uuid, physical: 1, dir: "out", value: 0 }),
			);
		case "get-flash":
			return unwrapAction(await signFlash({ uuid }));
		case "get-flash-ports":
			return unwrapAction(await signFlash({ uuid, ports: true }));
		case "put-wifi":
			return unwrapAction(
				await signWifi({
					uuid,
					ssid: BLE_HEALTH_WIFI_SSID,
					psk: BLE_HEALTH_WIFI_PSK,
				}),
			);
		default:
			throw new Error(`no signer for ${id}`);
	}
}
