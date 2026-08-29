import {
	POST as claimPairing,
	GET as getPairing,
	PUT as signCredentials,
	DELETE as unpairDevice,
} from "@api/pair";
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
	giteaLoginFromEmail,
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
	const [giteaLogin, setGiteaLogin] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [paired, setPaired] = useState("");
	const [pasteText, setPasteText] = useState("");

	useEffect(() => {
		if (!session.data?.id) {
			return;
		}
		void getPairing().then((result) => {
			if (result.paired) {
				setPaired(result.device.giteaLogin);
				setDeviceUrl(result.device.deviceUrl);
			}
		});
		if (!giteaLogin && session.data?.email) {
			setGiteaLogin(giteaLoginFromEmail(session.data.email));
		}
	}, [session.data?.id, session.data?.email, giteaLogin]);

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
			const body = JSON.parse(raw) as { uuid?: string; key?: string };
			if (!body.uuid || !body.key) {
				throw new Error("device did not return pairing credentials");
			}
			setUuid(body.uuid);
			setKey(body.key);
			setStatus("credentials loaded");
		} catch (caught) {
			setStatus("");
			setError(caught instanceof Error ? caught.message : "retrieve failed");
		}
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
				giteaLogin,
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
			if ("giteaLogin" in body) {
				setPaired(body.giteaLogin);
			}
			if ("deviceUrl" in body) {
				setDeviceUrl(body.deviceUrl);
				onComplete?.(body.deviceUrl);
			}
			setStatus("paired");
			setKey("");
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
					{paired ? (
						<Alert severity="success">Paired as Gitea account {paired}</Alert>
					) : null}
					<Button
						type="button"
						variant="outlined"
						onClick={() => void retrieveCredentials()}
					>
						{supported
							? "Get UUID and key over Bluetooth"
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
						placeholder="https://pi.example.com:4150 (optional if using BLE)"
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
					<TextField
						label="Gitea account"
						value={giteaLogin}
						onChange={(event) => setGiteaLogin(event.target.value)}
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
					{status ? <Typography color="secondary">{status}</Typography> : null}
					{error ? <Alert severity="error">{error}</Alert> : null}
				</Stack>
			</form>
		</Paper>
	);
}
