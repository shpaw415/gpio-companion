import { GET as getDevice } from "@api/device";
import { GET as loadDeviceInfo } from "@api/device/info";
import { GET as listNotes } from "@api/notifications";
import { GET as getPairing, DELETE as unpairDevice } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Dialog, {
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@shpaw415/mui-lite/Dialog";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useState } from "react";
import DeviceBoardCard, {
	type BoardView,
	type DeviceStatus,
} from "../../components/DeviceBoardCard.tsx";
import PairForm from "../../components/PairForm.tsx";
import SectionHub, { SectionHeader } from "../../components/Section.tsx";
import { BoardCardSkeleton } from "../../components/skeletons.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";
import { useDashboardMode } from "../../hooks/useDashboardMode.tsx";
import useMobile from "../../hooks/useMobile.ts";

export default function DevicesPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const { isEasy } = useDashboardMode();
	const mobile = useMobile();
	const { uuid: selectedUuid, setUuid: selectBoard } = useBoardSelection();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [boards, setBoards] = useState<BoardView[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [pendingCount, setPendingCount] = useState(0);
	const [t3AutoStartUuid, setT3AutoStartUuid] = useState("");
	const [unpairing, setUnpairing] = useState("");

	const refresh = useCallback(async () => {
		if (!session.data?.id) {
			setBoards([]);
			setPendingCount(0);
			setLoading(false);
			return;
		}
		setLoading(true);
		const result = await run(getPairing());
		if (!result?.paired) {
			setBoards([]);
		} else {
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
		}
		if (isEasy) {
			const notes = await run(listNotes());
			setPendingCount(notes?.items.length ?? 0);
		} else {
			setPendingCount(0);
		}
		setLoading(false);
	}, [session.data?.id, run, isEasy]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (boards.length === 0) {
			return;
		}
		if (selectedUuid && boards.some((b) => b.device.uuid === selectedUuid)) {
			return;
		}
		selectBoard(boards[0]?.device.uuid ?? "");
	}, [boards, selectedUuid, selectBoard]);

	const showForm = loggedIn && !loading && boards.length === 0;

	return (
		<Stack spacing={3}>
			<Stack
				direction={mobile ? "column" : "row"}
				spacing={2}
				className="min-[900px]:items-start min-[900px]:justify-between"
			>
				<SectionHeader title={isEasy ? "My board" : "Devices"}>
					<Typography color="secondary">
						{isEasy
							? "Your Arduino companion board. Pair it, put it on Wi‑Fi, then open Code."
							: "Boards paired to your account and how they reach the dashboard."}
					</Typography>
				</SectionHeader>
				{loggedIn && boards.length > 0 ? (
					<Button
						type="button"
						variant="contained"
						className={mobile ? "w-full" : undefined}
						onClick={() => setDialogOpen(true)}
					>
						Add board
					</Button>
				) : null}
			</Stack>

			{!loggedIn ? (
				<Alert severity="info">
					<Button href="/login" variant="text">
						Sign in
					</Button>{" "}
					to manage your boards.
				</Alert>
			) : null}

			{loggedIn && isEasy && pendingCount > 0 ? (
				<Alert severity="info">
					Someone asked to take a board.{" "}
					<Button href="/devices/notifications" variant="text">
						Review requests
					</Button>
				</Alert>
			) : null}

			{loggedIn && loading ? (
				<>
					<BoardCardSkeleton />
					<BoardCardSkeleton />
				</>
			) : null}

			{showForm ? (
				<>
					<Typography color="secondary">
						Connect over Bluetooth to load pairing details from the board. Then
						set Wi‑Fi from the WiFi tab if it is not on Ethernet.
					</Typography>
					<PairForm
						onComplete={({ uuid }) => {
							setT3AutoStartUuid(uuid);
							void refresh();
						}}
					/>
				</>
			) : null}

			{boards.map((board) => (
				<DeviceBoardCard
					key={board.device.uuid}
					device={board.device}
					status={board.status}
					selected={board.device.uuid === selectedUuid}
					onSelect={selectBoard}
					loadInfo={isEasy ? undefined : loadDeviceInfo}
					t3AutoStart={t3AutoStartUuid === board.device.uuid}
					unpairing={unpairing === board.device.uuid}
					onLabelSaved={(label) => {
						setBoards((current) =>
							current.map((item) =>
								item.device.uuid === board.device.uuid
									? { ...item, device: { ...item.device, label } }
									: item,
							),
						);
					}}
					onUnpair={(uuid) => {
						setUnpairing(uuid);
						void run(unpairDevice(uuid)).then((result) => {
							setUnpairing("");
							if (!result) {
								return;
							}
							if (t3AutoStartUuid === uuid) {
								setT3AutoStartUuid("");
							}
							void refresh();
						});
					}}
				/>
			))}

			{isEasy ? null : (
				<SectionHub
					description="Everything you can do with a board."
					items={[
						{
							href: "/devices/docs",
							title: "Learn",
							description:
								"Official gpio-companion docs for the selected board — guides, wiring, and pinouts.",
						},
						{
							href: "/devices/t3",
							title: "Code",
							description:
								"Open Code on a paired board in this dashboard. Switching tabs keeps your place.",
						},
						{
							href: "/devices/pair",
							title: "Pair hardware",
							description:
								"Claim a board, then start Code to get a pair code, QR, and board pairing URL.",
						},
						{
							href: "/devices/wifi",
							title: "WiFi over Bluetooth",
							description:
								"Have the dashboard sign a WiFi command the board verifies before connecting.",
						},
						{
							href: "/profile/github",
							title: "GitHub",
							description:
								"Connect the gpio-companion GitHub App so boards can push project files.",
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
			)}

			<Dialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				fullWidth
				fullScreen={mobile}
				scroll="paper"
				sx={{ zIndex: 1300 }}
				slotProps={{ paper: { className: "max-w-xl w-full" } }}
			>
				<DialogTitle>Add board</DialogTitle>
				<DialogContent>
					{dialogOpen ? (
						<PairForm
							variant="dialog"
							onComplete={({ uuid }) => {
								setT3AutoStartUuid(uuid);
								void refresh();
							}}
						/>
					) : null}
				</DialogContent>
				<DialogActions>
					<Button
						type="button"
						variant="text"
						onClick={() => setDialogOpen(false)}
					>
						Close
					</Button>
				</DialogActions>
			</Dialog>
		</Stack>
	);
}
