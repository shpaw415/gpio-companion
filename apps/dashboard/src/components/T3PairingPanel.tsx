import { GET as getT3, POST as t3Action } from "@api/t3";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { extractT3PairingToken } from "gpio-companion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActionError } from "../hooks/useActionError.tsx";
import { unwrapAction } from "../lib/action.ts";
import CopyBlock from "./CopyBlock.tsx";
import DeviceSelect, { type DeviceOption } from "./DeviceSelect.tsx";
import QrCode from "./QrCode.tsx";

export type T3StatusSeed = {
	running?: boolean;
	pairingUrl?: string;
	pairingToken?: string;
	paired?: boolean;
	serviceInstalled?: boolean;
};

export default function T3PairingPanel({
	devices,
	uuid,
	autoStart = false,
	initialStatus,
	skipFetch = false,
}: {
	devices: DeviceOption[];
	uuid?: string;
	autoStart?: boolean;
	initialStatus?: T3StatusSeed;
	skipFetch?: boolean;
}) {
	const { run } = useActionError();
	const [selected, setSelected] = useState(uuid || devices[0]?.uuid || "");
	const [pairingUrl, setPairingUrl] = useState(initialStatus?.pairingUrl ?? "");
	const [pairingToken, setPairingToken] = useState(
		tokenFrom(initialStatus?.pairingUrl, initialStatus?.pairingToken),
	);
	const [t3Ready, setT3Ready] = useState(
		Boolean(initialStatus?.serviceInstalled),
	);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const autoStarted = useRef("");
	const seedUrl = initialStatus?.pairingUrl ?? "";
	const seedToken = tokenFrom(
		initialStatus?.pairingUrl,
		initialStatus?.pairingToken,
	);
	const seedReady = Boolean(initialStatus?.serviceInstalled);

	useEffect(() => {
		if (uuid) {
			setSelected(uuid);
			return;
		}
		setSelected((current) => {
			if (current && devices.some((device) => device.uuid === current)) {
				return current;
			}
			return devices[0]?.uuid ?? "";
		});
	}, [uuid, devices]);

	const startPairing = useCallback(async (boardUuid: string) => {
		setBusy(true);
		setError("");
		setT3Ready(false);
		setStatus("starting T3 Code…");
		try {
			const started = unwrapAction(await t3Action("start", boardUuid));
			const token = tokenFrom(started.pairingUrl, started.pairingToken);
			setPairingUrl(started.pairingUrl);
			setPairingToken(token);
			setStatus("scan the QR or open the pairing URL in the browser");
		} catch (caught) {
			setStatus("");
			setError(caught instanceof Error ? caught.message : "T3 start failed");
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		if (!selected) {
			setPairingUrl("");
			setPairingToken("");
			setT3Ready(false);
			return;
		}
		if (autoStart) {
			return;
		}
		if (skipFetch) {
			setPairingUrl(seedUrl);
			setPairingToken(seedToken);
			setT3Ready(seedReady);
			return;
		}
		setPairingUrl("");
		setPairingToken("");
		setT3Ready(false);
		void run(getT3(selected)).then((result) => {
			if (!result) {
				return;
			}
			if (result.pairingUrl) {
				setPairingUrl(result.pairingUrl);
				setPairingToken(tokenFrom(result.pairingUrl, result.pairingToken));
			}
			if (result.serviceInstalled) {
				setT3Ready(true);
			}
		});
	}, [selected, run, autoStart, skipFetch, seedUrl, seedToken, seedReady]);

	useEffect(() => {
		if (!autoStart || !selected || autoStarted.current === selected) {
			return;
		}
		autoStarted.current = selected;
		void startPairing(selected);
	}, [autoStart, selected, startPairing]);

	useEffect(() => {
		if (!pairingUrl || t3Ready || !selected) {
			return;
		}
		const timer = window.setInterval(() => {
			void run(getT3(selected)).then(async (result) => {
				if (!result) {
					return;
				}
				if (result.serviceInstalled) {
					setT3Ready(true);
					setStatus("T3 Code is persistent on the Pi");
					return;
				}
				if (result.paired) {
					setStatus("T3 paired — installing service…");
					if (await run(t3Action("persist", selected))) {
						setT3Ready(true);
						setStatus("T3 Code is persistent on the Pi");
					}
				}
			});
		}, 3000);
		return () => window.clearInterval(timer);
	}, [pairingUrl, t3Ready, selected, run]);

	if (devices.length === 0) {
		return null;
	}

	return (
		<Stack spacing={1}>
			<Typography variant="subtitle1">T3 Code pairing</Typography>
			<Typography variant="body2" color="secondary">
				Start T3 on the Pi, then scan the QR or open the board pairing URL.
			</Typography>
			{!uuid && devices.length > 1 ? (
				<DeviceSelect
					devices={devices}
					value={selected}
					onChange={setSelected}
					label="T3 device"
					disabled={busy}
				/>
			) : null}
			<Button
				type="button"
				variant="contained"
				disabled={busy || !selected}
				onClick={() => void startPairing(selected)}
			>
				Start T3 pairing
			</Button>
			{pairingUrl ? (
				<>
					{pairingToken ? (
						<CopyBlock label="T3 pair code" value={pairingToken} />
					) : null}
					<QrCode value={pairingUrl} label="T3 pairing QR code" />
					<Button
						type="button"
						variant="contained"
						onClick={() => {
							window.open(pairingUrl, "_blank", "noopener,noreferrer");
						}}
					>
						Open pairing URL
					</Button>
					<CopyBlock label="T3 pairing URL" value={pairingUrl} />
				</>
			) : null}
			{t3Ready ? (
				<Alert severity="success">T3 Code service installed</Alert>
			) : pairingUrl ? (
				<Button
					type="button"
					variant="outlined"
					disabled={busy || !selected}
					onClick={() => {
						void run(t3Action("persist", selected)).then((result) => {
							if (!result) {
								return;
							}
							setT3Ready(true);
							setStatus("T3 Code is persistent on the Pi");
						});
					}}
				>
					I’ve paired
				</Button>
			) : null}
			{status ? <Typography color="secondary">{status}</Typography> : null}
			{error ? <Alert severity="error">{error}</Alert> : null}
		</Stack>
	);
}

function tokenFrom(url?: string, token?: string): string {
	if (token?.trim()) {
		return token.trim();
	}
	if (!url) {
		return "";
	}
	return extractT3PairingToken(url);
}
