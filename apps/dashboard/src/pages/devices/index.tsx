import { GET as getDevice } from "@api/device";
import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import DeviceLabelField from "../../components/DeviceLabelField.tsx";
import SectionHub, { SectionHeader } from "../../components/Section.tsx";
import T3PairingPanel from "../../components/T3PairingPanel.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import {
	deviceDisplayName,
	type StoredPairing,
} from "../../lib/pairing-store.ts";

type DeviceStatus = {
	hardware?: string;
	tunnel?: { configured?: boolean; apiHostname?: string };
	secrets?: { githubReady?: boolean; gpioAiKey?: boolean };
	t3?: {
		running?: boolean;
		pairingUrl?: string;
		pairingToken?: string;
		paired?: boolean;
		serviceInstalled?: boolean;
	};
};

type BoardView = {
	device: StoredPairing;
	status: DeviceStatus | null;
};

export default function DevicesPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [boards, setBoards] = useState<BoardView[]>([]);

	useEffect(() => {
		if (!session.data?.id) {
			setBoards([]);
			return;
		}
		void run(getPairing()).then(async (result) => {
			if (!result?.paired) {
				setBoards([]);
				return;
			}
			const device = await run(getDevice());
			if (device?.paired) {
				setBoards(
					device.devices.map((item) => ({
						device: item.device,
						status: item.status as DeviceStatus | null,
					})),
				);
			} else {
				setBoards(
					result.devices.map((item) => ({ device: item, status: null })),
				);
			}
		});
	}, [session.data?.id, run]);

	return (
		<Stack spacing={3}>
			<SectionHeader title="Devices">
				<Typography color="secondary">
					Boards paired to your account and how they reach the dashboard.
				</Typography>
			</SectionHeader>

			{!loggedIn ? (
				<Alert severity="info">
					<Button href="/login" variant="text">
						Sign in
					</Button>{" "}
					to manage your boards.
				</Alert>
			) : null}

			{loggedIn && boards.length === 0 ? (
				<Alert severity="info">
					<Button href="/devices/pair" variant="text">
						Pair a board
					</Button>{" "}
					to use the device API from this dashboard.
				</Alert>
			) : null}

			{boards.map((board) => (
				<Paper key={board.device.uuid} className="max-w-2xl p-6" elevation={1}>
					<Stack spacing={2}>
						<Typography variant="h6">
							{deviceDisplayName(board.device)}
						</Typography>
						<Typography color="secondary">{board.device.uuid}</Typography>
						{board.device.deviceUrl ? (
							<Typography color="secondary">
								{board.device.deviceUrl}
							</Typography>
						) : null}
						<DeviceLabelField
							key={board.device.uuid}
							uuid={board.device.uuid}
							label={board.device.label}
							onSaved={(label) => {
								setBoards((current) =>
									current.map((item) =>
										item.device.uuid === board.device.uuid
											? {
													...item,
													device: { ...item.device, label },
												}
											: item,
									),
								);
							}}
						/>
						{board.status ? (
							<Stack direction="row" spacing={1} className="flex-wrap">
								{board.status.hardware ? (
									<Chip label={board.status.hardware} variant="outlined" />
								) : null}
								<Chip
									label={
										board.status.tunnel?.configured
											? "tunnel ready"
											: "tunnel pending"
									}
									color={
										board.status.tunnel?.configured ? "success" : "secondary"
									}
									variant="outlined"
								/>
								<Chip
									label={
										board.status.secrets?.githubReady
											? "GitHub ready"
											: "GitHub keys pending"
									}
									color={
										board.status.secrets?.githubReady ? "success" : "warning"
									}
									variant="outlined"
								/>
								<Chip
									label={
										board.status.t3?.paired
											? "T3 Code paired"
											: board.status.t3?.running
												? "T3 Code running"
												: "T3 Code idle"
									}
									color={board.status.t3?.paired ? "success" : "secondary"}
									variant="outlined"
								/>
							</Stack>
						) : (
							<Typography color="secondary">
								Board status unavailable — is the Pi online?
							</Typography>
						)}
						<T3PairingPanel
							devices={[board.device]}
							uuid={board.device.uuid}
							initialStatus={board.status?.t3}
							skipFetch
						/>
					</Stack>
				</Paper>
			))}

			<SectionHub
				description="Everything you can do with a board."
				items={[
					{
						href: "/devices/pair",
						title: "Pair hardware",
						description:
							"Claim a board, then start T3 Code to get a pair code, QR, and board pairing URL.",
					},
					{
						href: "/devices/wifi",
						title: "WiFi over Bluetooth",
						description:
							"Have the dashboard sign a WiFi command the Pi verifies before connecting.",
					},
					{
						href: "/devices/keys",
						title: "GitHub keys",
						description:
							"Save your GitHub username and PAT to the paired Pi for per-project git.",
					},
					{
						href: "/devices/notifications",
						title: "Pairing requests",
						description:
							"Accept or reject incoming board transfers from other users.",
					},
				]}
			/>
		</Stack>
	);
}
