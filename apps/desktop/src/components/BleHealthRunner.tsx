import Button from "@shpaw415/mui-lite/Button";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { apiRequest, bleHealthRun } from "../api";
import {
	BLE_HEALTH_CHECKS,
	BLE_HEALTH_WIFI_PSK,
	BLE_HEALTH_WIFI_SSID,
	type BleHealthCheckId,
	evaluateBleHealthCheck,
	parseBleHealthBody,
} from "../ble-health";

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
	const [rows, setRows] = useState<Row[]>(emptyRows);
	const [busy, setBusy] = useState(false);

	function patch(id: BleHealthCheckId, next: Partial<Row>) {
		setRows((current) =>
			current.map((row) => (row.id === id ? { ...row, ...next } : row)),
		);
	}

	function skipRest(failedId: BleHealthCheckId, reason: string) {
		setRows((current) =>
			current.map((row) => {
				if (
					row.id === failedId ||
					row.state === "pass" ||
					row.state === "fail"
				) {
					return row;
				}
				return { ...row, state: "skipped", log: `Skipped: ${reason}` };
			}),
		);
	}

	async function run() {
		if (!uuid || busy) {
			return;
		}
		setBusy(true);
		setRows(emptyRows());
		try {
			for (const check of BLE_HEALTH_CHECKS) {
				patch(check.id, { state: "running", log: "" });
			}
			const probes = [];
			for (const check of BLE_HEALTH_CHECKS) {
				if (check.id === "gatt-info") {
					probes.push({ id: check.id });
					continue;
				}
				try {
					probes.push({
						id: check.id,
						envelope: await signProbe(uuid, check.id),
					});
				} catch (caught) {
					const verdict = evaluateBleHealthCheck(check.id, {
						error: caught instanceof Error ? caught.message : "sign failed",
					});
					patch(check.id, {
						state: verdict.pass ? "pass" : "fail",
						log: verdict.pass ? "" : verdict.detail,
					});
				}
			}
			const hits = await bleHealthRun({ uuid, probes });
			for (const hit of hits) {
				const id = hit.id as BleHealthCheckId;
				const verdict = evaluateBleHealthCheck(id, {
					selectedUuid: uuid,
					error: hit.error,
					body: hit.body ?? parseBleHealthBody(hit.raw ?? ""),
				});
				patch(id, {
					state: verdict.pass ? "pass" : "fail",
					log: verdict.pass ? "" : verdict.detail,
				});
				if (id === "gatt-info" && !verdict.pass) {
					skipRest(id, verdict.detail);
					return;
				}
			}
		} catch (caught) {
			const detail =
				caught instanceof Error ? caught.message : "bluetooth test failed";
			skipRest("gatt-info", detail);
			patch("gatt-info", { state: "fail", log: detail });
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={1} sx={{ mt: 1 }}>
			<Typography variant="subtitle2">Bluetooth endpoints</Typography>
			<Typography color="secondary" variant="body2">
				Runtime healthcheck of GATT info plus each companion route the Pi
				accepts over Bluetooth. WiFi uses a probe SSID that should not exist.
				GPIO write targets physical pin 1 (power) and must be refused.
			</Typography>
			<Button
				variant="outlined"
				disabled={!uuid || busy}
				onClick={() => void run()}
			>
				{busy ? "Testing…" : "Test Bluetooth"}
			</Button>
			<Stack spacing={1}>
				{rows.map((row) => (
					<Stack key={row.id} spacing={0.5}>
						<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
							<StatusMark state={row.state} />
							<Typography variant="body2">{row.name}</Typography>
						</Stack>
						{row.log ? (
							<Typography
								color="error"
								variant="body2"
								sx={{
									pl: 3,
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

async function signProbe(uuid: string, id: BleHealthCheckId) {
	switch (id) {
		case "get-info":
			return apiRequest("POST", "/api/mobile/info", { uuid });
		case "get-gpio":
			return apiRequest("POST", "/api/mobile/gpio", { uuid });
		case "put-gpio-power":
			return apiRequest("POST", "/api/mobile/gpio", {
				uuid,
				physical: 1,
				dir: "out",
				value: 0,
			});
		case "get-flash":
			return apiRequest("POST", "/api/mobile/flash", { uuid });
		case "get-flash-ports":
			return apiRequest("POST", "/api/mobile/flash", { uuid, ports: true });
		case "put-wifi":
			return apiRequest("POST", "/api/mobile/wifi", {
				uuid,
				ssid: BLE_HEALTH_WIFI_SSID,
				psk: BLE_HEALTH_WIFI_PSK,
			});
		default:
			throw new Error(`no signer for ${id}`);
	}
}
