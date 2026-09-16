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
	formatBleHealthReport,
	parseBleHealthBody,
} from "../ble-health";
import { useSavedBleId } from "../hooks/useApiCache";
import { useT } from "../locale";

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
	const t = useT();
	const [rows, setRows] = useState<Row[]>(emptyRows);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const bleId = useSavedBleId(uuid);
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
		await navigator.clipboard.writeText(text).catch(() => undefined);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
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
				return {
					...row,
					state: "skipped",
					log: t("debug.skipped", { reason }),
				};
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
			const hits = await bleHealthRun({ uuid, id: bleId, probes });
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
			<Typography variant="subtitle2">{t("debug.bleTitle")}</Typography>
			<Typography color="secondary" variant="body2">
				{t("debug.bleHint")}
			</Typography>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button
					variant="outlined"
					disabled={!uuid || busy}
					onClick={() => void run()}
				>
					{busy ? t("debug.testing") : t("debug.testBluetooth")}
				</Button>
				<Button
					variant="outlined"
					disabled={!hasResults}
					onClick={() => void copyResults()}
				>
					{copied ? t("common.copied") : t("debug.copyResults")}
				</Button>
			</Stack>
			<Stack spacing={1}>
				{rows.map((row) => (
					<Stack key={row.id} spacing={0.5}>
						<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
							<StatusMark
								state={row.state}
								passed={t("debug.passed")}
								failed={t("debug.failed")}
								idle={t("debug.idle")}
								skipped={t("debug.skipped", { reason: "" }).trim()}
							/>
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

function StatusMark({
	state,
	passed,
	failed,
	idle,
	skipped,
}: {
	state: RowState;
	passed: string;
	failed: string;
	idle: string;
	skipped: string;
}) {
	if (state === "running") {
		return <CircularProgress size="16px" />;
	}
	if (state === "pass") {
		return (
			<Typography color="success" variant="body2" aria-label={passed}>
				✓
			</Typography>
		);
	}
	if (state === "fail") {
		return (
			<Typography color="error" variant="body2" aria-label={failed}>
				✕
			</Typography>
		);
	}
	if (state === "skipped") {
		return (
			<Typography color="secondary" variant="body2" aria-label={skipped}>
				–
			</Typography>
		);
	}
	return (
		<Typography color="secondary" variant="body2" aria-label={idle}>
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
		case "get-run":
			return apiRequest("POST", "/api/mobile/run", { uuid });
		case "get-console":
			return apiRequest("POST", "/api/mobile/console", { uuid });
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
