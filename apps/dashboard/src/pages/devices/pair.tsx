import { GET as getDevice } from "@api/device";
import { GET as getPairing, DELETE as unpairDevice } from "@api/pair";
import DeviceBoardCard, {
	type BoardView,
	type DeviceStatus,
} from "@components/DeviceBoardCard";
import PairForm from "@components/PairForm";
import Button from "@shpaw415/mui-lite/Button";
import Dialog, {
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@shpaw415/mui-lite/Dialog";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "../../components/Section.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import useMobile from "../../hooks/useMobile.ts";

export default function PairPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [boards, setBoards] = useState<BoardView[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const mobile = useMobile();
	const [t3AutoStartUuid, setT3AutoStartUuid] = useState("");
	const [unpairing, setUnpairing] = useState("");

	const refresh = useCallback(async () => {
		if (!session.data?.id) {
			setBoards([]);
			setLoaded(true);
			return;
		}
		const result = await run(getPairing());
		if (!result?.paired) {
			setBoards([]);
			setLoaded(true);
			setDialogOpen(false);
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
			setBoards(result.devices.map((item) => ({ device: item, status: null })));
		}
		setLoaded(true);
	}, [session.data?.id, run]);

	useEffect(() => {
		setLoaded(false);
		void refresh();
	}, [refresh]);

	const showForm = !loggedIn || (loaded && boards.length === 0);
	const showCards = loggedIn && loaded && boards.length > 0;

	return (
		<Stack spacing={3}>
			{showCards ? (
				<Stack
					direction={mobile ? "column" : "row"}
					spacing={2}
					className="min-[900px]:items-start min-[900px]:justify-between"
				>
					<SectionHeader title="Pair hardware" />
					<Button
						type="button"
						variant="contained"
						className={mobile ? "w-full" : undefined}
						onClick={() => setDialogOpen(true)}
					>
						Pair another device
					</Button>
				</Stack>
			) : (
				<SectionHeader title="Pair hardware" />
			)}
			{showCards ? (
				<Typography color="secondary">
					Boards paired to this account. Pair another device to claim a second
					Pi.
				</Typography>
			) : null}
			{showForm ? (
				<Typography color="secondary">
					Connect over Bluetooth to load Device URL, pairing UUID, and key from
					the Pi. If Web Bluetooth is unavailable, the dashboard signs a command
					to paste in LightBlue or nRF Connect. Console printout still works.
					You can pair more than one board. After claim (or anytime from Devices
					overview), start T3 Code to get a pair code, QR, and board pairing
					URL. Then set WiFi from{" "}
					<a href="/devices/wifi">WiFi over Bluetooth</a> or Ethernet/TTY, and
					connect GitHub on Keys.
				</Typography>
			) : null}
			{showForm ? (
				<PairForm
					onComplete={({ uuid }) => {
						setT3AutoStartUuid(uuid);
						void refresh();
					}}
				/>
			) : null}
			{showCards
				? boards.map((board) => (
						<DeviceBoardCard
							key={board.device.uuid}
							device={board.device}
							status={board.status}
							t3AutoStart={!dialogOpen && t3AutoStartUuid === board.device.uuid}
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
					))
				: null}
			<Dialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				fullWidth
				fullScreen={mobile}
				scroll="paper"
				sx={{ zIndex: 1300 }}
				slotProps={{ paper: { className: "max-w-xl w-full" } }}
			>
				<DialogTitle>Pair another device</DialogTitle>
				<DialogContent>
					{dialogOpen ? (
						<PairForm
							variant="dialog"
							onComplete={() => {
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
