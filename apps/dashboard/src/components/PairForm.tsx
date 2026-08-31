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
	publicDeviceUrl,
	tunnelHostnames,
} from "gpio-companion";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useActionError } from "../hooks/useActionError.tsx";
import { useAuthSession } from "../hooks/useAuth.ts";
import { unwrapAction } from "../lib/action.ts";
import type { StoredPairing } from "../lib/pairing-store.ts";
import {
	bluetoothAvailable,
	bluetoothChooserCancelled,
	connectGpioCompanionBle,
} from "../lib/web-bluetooth.ts";
import CopyBlock from "./CopyBlock.tsx";
import DeviceSelect from "./DeviceSelect.tsx";
import T3PairingPanel from "./T3PairingPanel.tsx";

const LIGHTBLUE = "https://apps.apple.com/app/lightblue/id557428110";
const NRF_CONNECT =
	"https://apps.apple.com/app/nrf-connect-for-mobile/id1054366564";

export default function PairForm({
	onComplete,
}: {
	onComplete?: (deviceUrl: string) => void;
}) {
	const session = useAuthSession();
	const { run } = useActionError();
	const [bleReady, setBleReady] = useState(false);
	const [deviceUrl, setDeviceUrl] = useState("");
	const [uuid, setUuid] = useState("");
	const [key, setKey] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [paired, setPaired] = useState("");
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [unpairUuid, setUnpairUuid] = useState("");
	const [t3Uuid, setT3Uuid] = useState("");
	const [t3AutoStart, setT3AutoStart] = useState(false);
	const [pasteText, setPasteText] = useState("");

	const applyDevices = useCallback((next: StoredPairing[]) => {
		setDevices(next);
		const last = next.at(-1);
		setPaired(last?.login ?? "");
		setUnpairUuid((current) => {
			if (current && next.some((device) => device.uuid === current)) {
				return current;
			}
			return last?.uuid ?? "";
		});
	}, []);

	useEffect(() => {
		void bluetoothAvailable().then(setBleReady);
	}, []);

	useEffect(() => {
		if (!session.data?.id) {
			return;
		}
		void run(getPairing()).then((result) => {
			applyDevices(result?.devices ?? []);
		});
	}, [session.data?.id, run, applyDevices]);

	async function applyCredentials(raw: string, infoDeviceUrl?: string) {
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
				infoDeviceUrl ||
				publicDeviceUrl(tunnelHostnames(body.uuid).apiHostname),
		);
		setStatus("credentials loaded");
	}

	async function copySignedCommand(
		envelope: Parameters<typeof envelopeToPasteText>[0],
		message = "copied — paste in LightBlue or nRF Connect, then read the status JSON",
	) {
		const text = envelopeToPasteText(envelope);
		setPasteText(text);
		await navigator.clipboard.writeText(text).catch(() => undefined);
		setStatus(message);
	}

	async function retrieveCredentials() {
		setError("");
		setStatus("checking Bluetooth…");
		try {
			const envelope = unwrapAction(await signCredentials());
			const canBle = await bluetoothAvailable();
			setBleReady(canBle);
			if (canBle) {
				setStatus("select a gpio-companion device…");
				try {
					const ble = await connectGpioCompanionBle();
					setStatus("reading pairing…");
					const raw = await ble.sendEnvelope(envelope);
					ble.disconnect();
					await applyCredentials(raw, ble.info.deviceUrl);
					return;
				} catch (caught) {
					if (bluetoothChooserCancelled(caught)) {
						setStatus("");
						return;
					}
				}
			}
			await copySignedCommand(envelope);
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
			const body = unwrapAction(
				await claimPairing({
					deviceUrl,
					uuid,
					key,
				}),
			);
			if ("pending" in body && body.pending) {
				setStatus("waiting for the current owner to accept in Notifications");
				setKey("");
				return;
			}
			if ("needsBle" in body && body.needsBle && "envelope" in body) {
				const canBle = await bluetoothAvailable();
				setBleReady(canBle);
				if (canBle) {
					try {
						const ble = await connectGpioCompanionBle();
						await ble.sendEnvelope(body.envelope);
						ble.disconnect();
					} catch (caught) {
						if (bluetoothChooserCancelled(caught)) {
							setStatus("");
							return;
						}
						await copySignedCommand(
							body.envelope,
							"claim copied — paste in LightBlue or nRF Connect to finish on the Pi",
						);
						return;
					}
				} else {
					await copySignedCommand(
						body.envelope,
						"claim copied — paste in LightBlue or nRF Connect to finish on the Pi",
					);
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
			const boardUuid =
				"uuid" in body && typeof body.uuid === "string" ? body.uuid : uuid;
			setStatus("paired");
			setKey("");
			const listing = await run(getPairing());
			applyDevices(listing?.devices ?? []);
			setT3Uuid(boardUuid);
			setT3AutoStart(true);
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
					{devices.length > 0 ? (
						<Alert severity="success">
							{devices.length === 1
								? `Paired as ${paired || devices[0]?.login}`
								: `${devices.length} boards paired`}
						</Alert>
					) : null}
					<Button
						type="button"
						variant="contained"
						onClick={() => void retrieveCredentials()}
					>
						{bleReady
							? "Connect over Bluetooth"
							: "Sign Bluetooth pairing command"}
					</Button>
					<Typography variant="body2" color="secondary">
						{bleReady
							? "Checks Web Bluetooth, then asks you to select gpio-companion. If that fails, a signed command is copied for LightBlue or nRF Connect."
							: "Web Bluetooth is unavailable. Paste the signed command into LightBlue or nRF Connect."}{" "}
						<Button href={LIGHTBLUE} variant="text">
							LightBlue
						</Button>{" "}
						or{" "}
						<Button href={NRF_CONNECT} variant="text">
							nRF Connect
						</Button>
						.
					</Typography>
					{bleReady ? null : (
						<>
							<CopyBlock label="Bluetooth name" value={BLE_DEVICE_NAME} />
							<CopyBlock label="Write characteristic" value={BLE_CMD_UUID} />
						</>
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
					{devices.length > 0 ? (
						<>
							{devices.length > 1 ? (
								<DeviceSelect
									devices={devices}
									value={unpairUuid}
									onChange={setUnpairUuid}
									label="Unpair device"
								/>
							) : null}
							<Button
								type="button"
								variant="outlined"
								onClick={() => {
									const target = unpairUuid || devices[0]?.uuid;
									if (!target) {
										return;
									}
									void run(unpairDevice(target)).then((result) => {
										if (!result) {
											return;
										}
										void run(getPairing()).then((listing) => {
											applyDevices(listing?.devices ?? []);
										});
										if (t3Uuid === target) {
											setT3Uuid("");
											setT3AutoStart(false);
										}
										setStatus("unpaired");
									});
								}}
							>
								Unpair (revokes T3 Code)
							</Button>
						</>
					) : null}
					{pasteText ? (
						<CopyBlock label="Signed Bluetooth command" value={pasteText} />
					) : null}
					<T3PairingPanel
						key={t3Uuid || "t3"}
						devices={devices}
						uuid={t3Uuid || undefined}
						autoStart={t3AutoStart}
					/>
					{status ? <Typography color="secondary">{status}</Typography> : null}
					{error ? <Alert severity="error">{error}</Alert> : null}
				</Stack>
			</form>
		</Paper>
	);
}
