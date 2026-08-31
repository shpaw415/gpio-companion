import {
	POST as claimPairing,
	GET as getPairing,
	PUT as signCredentials,
	DELETE as unpairDevice,
} from "@api/pair";
import { GET as getT3, POST as t3Action } from "@api/t3";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	envelopeToPasteText,
	publicDeviceUrl,
	tunnelHostnames,
} from "gpio-companion";
import { type FormEvent, useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";
import {
	bluetoothSupported,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";

const LIGHTBLUE = "https://apps.apple.com/app/lightblue/id557428110";
const NRF_CONNECT =
	"https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564";

export default function PairForm({
	onComplete,
}: {
	onComplete?: (deviceUrl: string) => void;
}) {
	const session = useAuthSession();
	const supported = bluetoothSupported();
	const [deviceUrl, setDeviceUrl] = useState("");
	const [uuid, setUuid] = useState("");
	const [key, setKey] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [paired, setPaired] = useState("");
	const [pasteText, setPasteText] = useState("");
	const [pairingUrl, setPairingUrl] = useState("");
	const [t3Ready, setT3Ready] = useState(false);

	useEffect(() => {
		if (!session.data?.id) {
			return;
		}
		void getPairing().then((result) => {
			if (result.paired) {
				setPaired(result.device.login);
				setDeviceUrl(result.device.deviceUrl);
			}
		});
	}, [session.data?.id]);

	async function retrieveCredentials() {
		setError("");
		setStatus("signing…");
		try {
			const envelope = await signCredentials();
			if (!supported) {
				const text = envelopeToPasteText(envelope);
				setPasteText(text);
				await navigator.clipboard.writeText(text).catch(() => undefined);
				setStatus("copied — paste in LightBlue, then read the status JSON");
				return;
			}
			setStatus("bluetooth…");
			const ble = await connectGpioCompanionBle();
			const raw = await ble.sendEnvelope(envelope);
			ble.disconnect();
			const body = JSON.parse(raw) as {
				uuid?: string;
				key?: string;
				deviceUrl?: string;
			};
			if (!body.uuid || !body.key) {
				throw new Error("device did not return pairing credentials");
			}
			setUuid(body.uuid);
			setKey(body.key);
			setDeviceUrl(
				body.deviceUrl ||
					ble.info.deviceUrl ||
					publicDeviceUrl(tunnelHostnames(body.uuid).apiHostname),
			);
			setStatus("credentials loaded");
		} catch (caught) {
			setStatus("");
			setError(caught instanceof Error ? caught.message : "retrieve failed");
		}
	}

	useEffect(() => {
		if (!pairingUrl || t3Ready) {
			return;
		}
		const timer = window.setInterval(() => {
			void getT3()
				.then(async (result) => {
					if (result.serviceInstalled) {
						setT3Ready(true);
						setStatus("T3 Code is persistent on the Pi");
						return;
					}
					if (result.paired) {
						setStatus("T3 paired — installing service…");
						await t3Action("persist");
						setT3Ready(true);
						setStatus("T3 Code is persistent on the Pi");
					}
				})
				.catch(() => undefined);
		}, 3000);
		return () => window.clearInterval(timer);
	}, [pairingUrl, t3Ready]);

	async function startT3Pairing() {
		setStatus("starting T3 Code…");
		const started = await t3Action("start");
		setPairingUrl(started.pairingUrl);
		setStatus("open the pairing URL in the browser");
	}

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		if (!session.data?.id) {
			setError("sign in first");
			return;
		}
		setError("");
		setStatus("pairing…");
		try {
			const body = await claimPairing({
				deviceUrl,
				uuid,
				key,
			});
			if ("pending" in body && body.pending) {
				setStatus("waiting for the current owner to accept in Notifications");
				setKey("");
				return;
			}
			if ("needsBle" in body && body.needsBle && "envelope" in body) {
				if (supported) {
					const ble = await connectGpioCompanionBle();
					await ble.sendEnvelope(body.envelope);
					ble.disconnect();
				} else {
					const text = envelopeToPasteText(body.envelope);
					setPasteText(text);
					await navigator.clipboard.writeText(text).catch(() => undefined);
					setStatus("claim copied — paste in LightBlue to finish on the Pi");
					return;
				}
			}
			if ("login" in body) {
				setPaired(body.login);
			}
			if ("deviceUrl" in body) {
				setDeviceUrl(body.deviceUrl);
				onComplete?.(body.deviceUrl);
			}
			setStatus("paired");
			setKey("");
			await startT3Pairing();
		} catch (caught) {
			setStatus("");
			setError(caught instanceof Error ? caught.message : "pair failed");
		}
	}

	if (!session.data?.id && !session.data?.email) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					Sign in
				</Button>{" "}
				to pair a board.
			</Typography>
		);
	}

	return (
		<Paper className="max-w-xl p-6" elevation={1}>
			<form onSubmit={onSubmit}>
				<Stack spacing={2}>
					{paired ? <Alert severity="success">Paired as {paired}</Alert> : null}
					<Button
						type="button"
						variant="outlined"
						onClick={() => void retrieveCredentials()}
					>
						{supported
							? "Get pairing over Bluetooth"
							: "Sign credentials command (iOS)"}
					</Button>
					{supported ? null : (
						<Typography variant="body2" color="secondary">
							Paste into{" "}
							<Button href={LIGHTBLUE} variant="text">
								LightBlue
							</Button>{" "}
							or{" "}
							<Button href={NRF_CONNECT} variant="text">
								nRF Connect
							</Button>{" "}
							→ {BLE_DEVICE_NAME} write {BLE_CMD_UUID}, then read status.
						</Typography>
					)}
					<TextField
						label="Device URL"
						placeholder="https://api-<uuid>.gpio-companion.com (optional)"
						value={deviceUrl}
						onChange={(event) => setDeviceUrl(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="Pairing UUID"
						value={uuid}
						onChange={(event) => setUuid(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="Pairing key"
						type="password"
						value={key}
						onChange={(event) => setKey(event.target.value)}
						className="w-full"
					/>
					<Button type="submit" variant="contained">
						Pair hardware
					</Button>
					{paired ? (
						<Button
							type="button"
							variant="outlined"
							onClick={() => {
								void unpairDevice().then(() => {
									setPaired("");
									setStatus("unpaired");
								});
							}}
						>
							Unpair (revokes T3 Code)
						</Button>
					) : null}
					{pasteText ? (
						<textarea
							readOnly
							className="w-full min-h-32 p-2 font-mono text-xs"
							value={pasteText}
						/>
					) : null}
					{pairingUrl ? (
						<Stack spacing={1}>
							<Typography variant="subtitle1">T3 Code pairing</Typography>
							<Button href={pairingUrl} variant="contained">
								Open pairing URL
							</Button>
							<textarea
								readOnly
								className="w-full min-h-16 p-2 font-mono text-xs"
								value={pairingUrl}
							/>
							{t3Ready ? (
								<Alert severity="success">T3 Code service installed</Alert>
							) : (
								<Button
									type="button"
									variant="outlined"
									onClick={() => {
										void t3Action("persist")
											.then(() => {
												setT3Ready(true);
												setStatus("T3 Code is persistent on the Pi");
											})
											.catch((caught) => {
												setError(
													caught instanceof Error
														? caught.message
														: "T3 service install failed",
												);
											});
									}}
								>
									I’ve paired
								</Button>
							)}
						</Stack>
					) : null}
					{status ? <Typography color="secondary">{status}</Typography> : null}
					{error ? <Alert severity="error">{error}</Alert> : null}
				</Stack>
			</form>
		</Paper>
	);
}
