import { useCallback, useEffect, useRef, useState } from "react";
import { claimDevice, signCredentials } from "../lib/api.ts";
import { useUserBoards } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import {
	createBoardLoss,
	ensureBluetoothOn,
	openBoardSession,
	readInfo,
	scanNearby,
	scannedDevice,
	sendEnvelope,
	type NearbyRadio,
} from "../lib/ble.ts";
import { NearbyPicker } from "../components/NearbyPicker.tsx";
import {
	Busy,
	ErrorText,
	Muted,
	PrimaryButton,
	Screen,
	TextButton,
	Title,
} from "../components/ui.tsx";
import { useDeviceHub } from "../lib/device-hub.tsx";

export default function Pair() {
	const auth = useAuth();
	const { setTab } = useDeviceHub();
	const { refetch: refetchBoards } = useUserBoards();
	const [boards, setBoards] = useState<NearbyRadio[]>([]);
	const [boardId, setBoardId] = useState("");
	const [status, setStatus] = useState("Ready to scan");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [paired, setPaired] = useState(false);
	const scanRef = useRef(0);

	const scan = useCallback(async () => {
		const generation = ++scanRef.current;
		setScanning(true);
		setError("");
		setPaired(false);
		setStatus("Scanning nearby Bluetooth…");
		try {
			await ensureBluetoothOn();
			const next = await scanNearby();
			if (scanRef.current !== generation) {
				return;
			}
			setBoards(next);
			const pick = next.find((board) => board.matched)?.id ?? next[0]?.id ?? "";
			setBoardId(pick);
			setStatus(
				next.length === 0
					? "No nearby devices — move closer and scan again"
					: "Select a device to pair with",
			);
		} catch (caught) {
			if (scanRef.current !== generation) {
				return;
			}
			setError(caught instanceof Error ? caught.message : "scan failed");
			setStatus("Ready to scan");
		} finally {
			if (scanRef.current === generation) {
				setScanning(false);
			}
		}
	}, []);

	useEffect(() => {
		void scan();
	}, [scan]);

	async function pair() {
		if (busy || scanning) {
			return;
		}
		if (!auth.token) {
			setError("sign in first");
			return;
		}
		if (!boardId) {
			setError("select a nearby Bluetooth device first");
			return;
		}
		const bleDevice = scannedDevice(boardId);
		if (!bleDevice) {
			setError("scan again and pick the board");
			return;
		}
		setBusy(true);
		setPaired(false);
		setError("");
		try {
			const loss = createBoardLoss();
			setStatus("Connecting…");
			const session = await openBoardSession(bleDevice, (why) => loss.lose(why));
			try {
				setStatus("Reading board…");
				const info = await readInfo(session.device);
				setStatus("Signing credentials…");
				const envelope = await signCredentials(auth.token);
				setStatus("Asking board for pairing key…");
				const raw = await sendEnvelope(session.device, envelope, loss);
				const creds = JSON.parse(raw) as {
					uuid?: string;
					key?: string;
					deviceUrl?: string;
				};
				if (!creds.uuid || !creds.key) {
					throw new Error("device did not return pairing credentials");
				}
				setStatus("Claiming…");
				await claimDevice(auth.token, {
					uuid: creds.uuid,
					key: creds.key,
					deviceUrl: creds.deviceUrl || info.deviceUrl,
				});
				await refetchBoards({ force: true }).catch(() => undefined);
				setStatus("Paired");
				setPaired(true);
			} finally {
				await session.close();
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "pair failed");
			setStatus("Select a device to pair with");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen>
			<Title>Pair a board</Title>
			<Muted>
				Select the Pi in Nearby Bluetooth device. Do not auto-claim the first advert.
			</Muted>
			<NearbyPicker
				boards={boards}
				selectedId={boardId}
				onSelect={setBoardId}
				scanning={scanning}
				disabled={busy}
			/>
			<Muted>{status}</Muted>
			<ErrorText>{error}</ErrorText>
			<Busy show={busy || scanning} />
			{paired ? (
				<TextButton label="Back to devices" onPress={() => setTab("overview")} />
			) : null}
			<TextButton
				label="Scan nearby"
				disabled={scanning || busy}
				onPress={() => void scan()}
			/>
			<PrimaryButton
				label="Pair selected"
				disabled={busy || scanning || !boardId || paired}
				onPress={() => void pair()}
			/>
		</Screen>
	);
}
