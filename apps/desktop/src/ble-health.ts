export const BLE_HEALTH_WIFI_SSID = "gpio-companion-ble-health-probe";
export const BLE_HEALTH_WIFI_PSK = "xxxxxxxx";

export type BleHealthCheckId =
	| "gatt-info"
	| "get-info"
	| "get-gpio"
	| "put-gpio-power"
	| "get-flash"
	| "get-flash-ports"
	| "get-run"
	| "get-console"
	| "put-wifi";

export type BleHealthCheck = {
	id: BleHealthCheckId;
	name: string;
	method: string;
	path: string;
};

export const BLE_HEALTH_CHECKS: BleHealthCheck[] = [
	{ id: "gatt-info", name: "READ GATT info", method: "READ", path: "info" },
	{ id: "get-info", name: "GET /v1/info", method: "GET", path: "/v1/info" },
	{ id: "get-gpio", name: "GET /v1/gpio", method: "GET", path: "/v1/gpio" },
	{
		id: "put-gpio-power",
		name: "PUT /v1/gpio",
		method: "PUT",
		path: "/v1/gpio",
	},
	{ id: "get-flash", name: "GET /v1/flash", method: "GET", path: "/v1/flash" },
	{
		id: "get-flash-ports",
		name: "GET /v1/flash/ports",
		method: "GET",
		path: "/v1/flash/ports",
	},
	{ id: "get-run", name: "GET /v1/run", method: "GET", path: "/v1/run" },
	{
		id: "get-console",
		name: "GET /v1/console",
		method: "GET",
		path: "/v1/console",
	},
	{
		id: "put-wifi",
		name: "PUT /v1/config/wifi",
		method: "PUT",
		path: "/v1/config/wifi",
	},
];

export type BleHealthVerdict = {
	pass: boolean;
	detail: string;
};

export type BleHealthReportRow = {
	name: string;
	state: string;
	log?: string;
};

export function formatBleHealthReport(rows: BleHealthReportRow[]): string {
	return rows
		.map((row) => {
			const mark =
				row.state === "pass"
					? "PASS"
					: row.state === "fail"
						? "FAIL"
						: row.state === "skipped"
							? "SKIP"
							: row.state === "running"
								? "RUN"
								: "IDLE";
			const line = `${mark}  ${row.name}`;
			const log = row.log?.trim();
			return log ? `${line}\n  ${log}` : line;
		})
		.join("\n");
}

export function parseBleHealthBody(raw: string): unknown {
	const text = raw.trim();
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return { error: `non-JSON status payload: ${text}` };
	}
}

export function bleHealthErrorMessage(body: unknown): string {
	if (!body || typeof body !== "object") {
		return "";
	}
	const error = (body as { error?: unknown }).error;
	return typeof error === "string" ? error.trim() : "";
}

export function evaluateBleHealthCheck(
	id: BleHealthCheckId,
	input: {
		selectedUuid?: string;
		error?: string;
		body?: unknown;
	},
): BleHealthVerdict {
	const thrown = input.error?.trim() ?? "";
	if (thrown) {
		if (id === "put-gpio-power" && isPowerPinRefusal(thrown)) {
			return {
				pass: true,
				detail: `Board refused pin 1 as required (${thrown}).`,
			};
		}
		if (id === "put-wifi" && isMissingSsidProbe(thrown)) {
			return {
				pass: true,
				detail: `WiFi handler ran and rejected the probe SSID (${thrown}).`,
			};
		}
		return {
			pass: false,
			detail: failMessage(id, thrown),
		};
	}
	return evaluateBody(id, input.selectedUuid ?? "", input.body);
}

function evaluateBody(
	id: BleHealthCheckId,
	selectedUuid: string,
	body: unknown,
): BleHealthVerdict {
	const error = bleHealthErrorMessage(body);
	if (
		id !== "gatt-info" &&
		body &&
		typeof body === "object" &&
		!Array.isArray(body) &&
		(body as { ready?: unknown }).ready === true &&
		Object.keys(body as object).length === 1
	) {
		return {
			pass: false,
			detail:
				'STATUS stayed {"ready":true}. The Pi BLE helper did not apply the CMD write or did not notify/read a result. Update gpio-companion on the board.',
		};
	}
	switch (id) {
		case "gatt-info": {
			const uuid =
				body && typeof body === "object"
					? String((body as { uuid?: unknown }).uuid ?? "").trim()
					: "";
			if (!uuid) {
				return {
					pass: false,
					detail:
						"GATT info characteristic did not include a pairing UUID. The Pi BLE helper may be advertising without pairing.env.",
				};
			}
			if (selectedUuid && uuid !== selectedUuid) {
				return {
					pass: false,
					detail: `GATT info UUID ${uuid} does not match the selected board ${selectedUuid}. You connected the wrong radio.`,
				};
			}
			return { pass: true, detail: `GATT info UUID ${uuid}` };
		}
		case "get-info": {
			if (error) {
				if (looksLikeInfoSnapshotText(error)) {
					return {
						pass: true,
						detail:
							"Companion info received over GATT (payload truncated to BLE MTU).",
					};
				}
				return {
					pass: false,
					detail: `GET /v1/info failed after BLE forward: ${error}`,
				};
			}
			if (!body || typeof body !== "object") {
				return {
					pass: false,
					detail: "GET /v1/info returned an empty payload over Bluetooth.",
				};
			}
			return { pass: true, detail: "Companion info JSON received over GATT." };
		}
		case "get-gpio": {
			if (error) {
				if (looksLikeGpioSnapshotText(error)) {
					return {
						pass: true,
						detail:
							"GPIO snapshot received over GATT (payload truncated to BLE MTU).",
					};
				}
				return {
					pass: false,
					detail: `GET /v1/gpio failed after BLE forward: ${error}`,
				};
			}
			const pins =
				body && typeof body === "object"
					? (body as { pins?: unknown }).pins
					: undefined;
			if (!Array.isArray(pins)) {
				return {
					pass: false,
					detail: `GET /v1/gpio JSON has no pins array. Body: ${JSON.stringify(body)}`,
				};
			}
			return {
				pass: true,
				detail: `GPIO snapshot has ${pins.length} header pins.`,
			};
		}
		case "put-gpio-power": {
			if (isPowerPinRefusal(error)) {
				return {
					pass: true,
					detail: `Board refused pin 1 as required (${error}).`,
				};
			}
			if (!error) {
				return {
					pass: false,
					detail:
						"PUT /v1/gpio on physical pin 1 should refuse power/GND, but the board accepted the write.",
				};
			}
			return {
				pass: false,
				detail: `PUT /v1/gpio pin 1 returned an unexpected error: ${error}`,
			};
		}
		case "get-flash": {
			if (error) {
				return {
					pass: false,
					detail: `GET /v1/flash failed after BLE forward: ${error}`,
				};
			}
			if (
				!body ||
				typeof body !== "object" ||
				typeof (body as { running?: unknown }).running !== "boolean"
			) {
				return {
					pass: false,
					detail: `GET /v1/flash JSON is missing running. Body: ${JSON.stringify(body)}`,
				};
			}
			return { pass: true, detail: "Flash status received over GATT." };
		}
		case "get-run": {
			if (error) {
				return {
					pass: false,
					detail: `GET /v1/run failed after BLE forward: ${error}`,
				};
			}
			if (
				!body ||
				typeof body !== "object" ||
				typeof (body as { running?: unknown }).running !== "boolean"
			) {
				return {
					pass: false,
					detail: `GET /v1/run JSON is missing running. Body: ${JSON.stringify(body)}`,
				};
			}
			return { pass: true, detail: "Host run status received over GATT." };
		}
		case "get-console": {
			if (error) {
				return {
					pass: false,
					detail: `GET /v1/console failed after BLE forward: ${error}`,
				};
			}
			const host =
				body && typeof body === "object"
					? (body as { host?: unknown }).host
					: undefined;
			const usb =
				body && typeof body === "object"
					? (body as { usb?: unknown }).usb
					: undefined;
			if (
				!host ||
				typeof host !== "object" ||
				typeof (host as { running?: unknown }).running !== "boolean" ||
				!usb ||
				typeof usb !== "object" ||
				typeof (usb as { open?: unknown }).open !== "boolean"
			) {
				return {
					pass: false,
					detail: `GET /v1/console JSON is missing host/usb. Body: ${JSON.stringify(body)}`,
				};
			}
			return {
				pass: true,
				detail: "Serial console snapshot received over GATT.",
			};
		}
		case "get-flash-ports": {
			if (error) {
				return {
					pass: false,
					detail: `GET /v1/flash/ports failed after BLE forward: ${error}`,
				};
			}
			const ports =
				body && typeof body === "object"
					? (body as { ports?: unknown }).ports
					: undefined;
			if (!Array.isArray(ports)) {
				return {
					pass: false,
					detail: `GET /v1/flash/ports JSON has no ports array. Body: ${JSON.stringify(body)}`,
				};
			}
			return {
				pass: true,
				detail: `Flash ports list has ${ports.length} entries.`,
			};
		}
		case "put-wifi": {
			if (
				isMissingSsidProbe(error) ||
				isMissingSsidProbe(JSON.stringify(body))
			) {
				return {
					pass: true,
					detail: `WiFi handler ran and rejected the probe SSID (${error || "ssid-not-found"}).`,
				};
			}
			const connected =
				body && typeof body === "object"
					? (body as { connected?: unknown }).connected
					: undefined;
			if (connected === true) {
				return {
					pass: false,
					detail:
						"Probe SSID unexpectedly connected. The healthcheck must not join a real network.",
				};
			}
			if (error) {
				return {
					pass: false,
					detail: `PUT /v1/config/wifi failed: ${error}`,
				};
			}
			return {
				pass: false,
				detail: `PUT /v1/config/wifi returned an unexpected payload: ${JSON.stringify(body)}`,
			};
		}
		default:
			return { pass: false, detail: `Unknown Bluetooth check ${id}` };
	}
}

function looksLikeGpioSnapshotText(text: string): boolean {
	return /"hardware"\s*:/.test(text) && /"pins"\s*:\s*\[/.test(text);
}

function looksLikeInfoSnapshotText(text: string): boolean {
	return /"dashboardUrl"\s*:/.test(text) || /"deviceAuth"\s*:/.test(text);
}

function isPowerPinRefusal(message: string): boolean {
	return /power|gnd|not gpio/i.test(message);
}

function isMissingSsidProbe(message: string): boolean {
	return /ssid-not-found|wifi network not found/i.test(message);
}

function failMessage(id: BleHealthCheckId, thrown: string): string {
	if (/timed out|timeout/i.test(thrown)) {
		return `Timed out waiting for the GATT status characteristic during ${checkName(id)}. The Pi BLE helper may not be running, or the board moved out of range.`;
	}
	if (/web bluetooth is not available/i.test(thrown)) {
		return "Web Bluetooth is not available in this browser. Use Chrome or Edge on a machine with Bluetooth, or the native app.";
	}
	if (/no gpio-companion board found|chooser|not found/i.test(thrown)) {
		return `No gpio-companion radio found for ${checkName(id)}. Hold the board close, then run the test again.`;
	}
	if (/sign|private key|not paired|uuid is required/i.test(thrown)) {
		return `Dashboard could not sign ${checkName(id)}: ${thrown}`;
	}
	return `${checkName(id)} broke: ${thrown}`;
}

function checkName(id: BleHealthCheckId): string {
	return BLE_HEALTH_CHECKS.find((item) => item.id === id)?.name ?? id;
}
