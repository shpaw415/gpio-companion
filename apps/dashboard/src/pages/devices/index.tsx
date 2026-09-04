import { GET as getDevice } from "@api/device";
import { GET as loadDeviceInfo } from "@api/device/info";
import { GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import DeviceBoardCard, {
	type BoardView,
	type DeviceStatus,
} from "../../components/DeviceBoardCard.tsx";
import SectionHub, { SectionHeader } from "../../components/Section.tsx";
import { BoardCardSkeleton } from "../../components/skeletons.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";

export default function DevicesPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const { uuid: selectedUuid, setUuid: selectBoard } = useBoardSelection();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [boards, setBoards] = useState<BoardView[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!session.data?.id) {
			setBoards([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		void run(getPairing())
			.then(async (result) => {
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
			})
			.finally(() => {
				setLoading(false);
			});
	}, [session.data?.id, run]);

	useEffect(() => {
		if (boards.length === 0) {
			return;
		}
		if (selectedUuid && boards.some((b) => b.device.uuid === selectedUuid)) {
			return;
		}
		selectBoard(boards[0]?.device.uuid ?? "");
	}, [boards, selectedUuid, selectBoard]);

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

			{loggedIn && loading ? (
				<>
					<BoardCardSkeleton />
					<BoardCardSkeleton />
				</>
			) : null}

			{loggedIn && !loading && boards.length === 0 ? (
				<Alert severity="info">
					<Button href="/devices/pair" variant="text">
						Pair a board
					</Button>{" "}
					to use the device API from this dashboard.
				</Alert>
			) : null}

			{boards.map((board) => (
				<DeviceBoardCard
					key={board.device.uuid}
					device={board.device}
					status={board.status}
					selected={board.device.uuid === selectedUuid}
					onSelect={selectBoard}
					loadInfo={loadDeviceInfo}
					onLabelSaved={(label) => {
						setBoards((current) =>
							current.map((item) =>
								item.device.uuid === board.device.uuid
									? { ...item, device: { ...item.device, label } }
									: item,
							),
						);
					}}
				/>
			))}

			<SectionHub
				description="Everything you can do with a board."
				items={[
					{
						href: "/devices/docs",
						title: "Documentation",
						description:
							"Official gpio-companion docs for the selected board — guides, wiring, and pinouts.",
					},
					{
						href: "/devices/t3",
						title: "T3 Code",
						description:
							"Open T3 Code on a paired Pi in this dashboard. Switching tabs keeps your place.",
					},
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
					{
						href: "/devices/debug",
						title: "Debug stream",
						description:
							"Watch live companion API errors and warnings over WebSocket.",
					},
				]}
			/>
		</Stack>
	);
}
