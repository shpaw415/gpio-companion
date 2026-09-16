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
import { useT } from "../../hooks/useLocale.tsx";
import useMobile from "../../hooks/useMobile.ts";

export default function DevicesPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const { isEasy } = useDashboardMode();
	const t = useT();
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
				<SectionHeader
					title={isEasy ? t("devices.titleEasy") : t("devices.titleExpert")}
				>
					<Typography color="secondary">
						{isEasy ? t("devices.easyHint") : t("devices.expertHint")}
					</Typography>
				</SectionHeader>
				{loggedIn && boards.length > 0 ? (
					<Button
						type="button"
						variant="contained"
						className={mobile ? "w-full" : undefined}
						onClick={() => setDialogOpen(true)}
					>
						{t("devices.addBoard")}
					</Button>
				) : null}
			</Stack>

			{!loggedIn ? (
				<Alert severity="info">
					<Button href="/login" variant="text">
						{t("auth.signIn")}
					</Button>{" "}
					{t("auth.toManageBoards")}
				</Alert>
			) : null}

			{loggedIn && isEasy && pendingCount > 0 ? (
				<Alert severity="info">
					{t("devices.pendingTransfer")}{" "}
					<Button href="/devices/notifications" variant="text">
						{t("devices.reviewRequests")}
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
						{t("devices.emptyPairHint")}
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
					description={t("devices.hubDescription")}
					items={[
						{
							href: "/devices/docs",
							title: t("nav.learn"),
							description: t("devices.learnDesc"),
						},
						{
							href: "/devices/t3",
							title: t("nav.code"),
							description: t("devices.codeDesc"),
						},
						{
							href: "/devices/pair",
							title: t("devices.pairHardware"),
							description: t("devices.pairHardwareDesc"),
						},
						{
							href: "/devices/wifi",
							title: t("wifi.title"),
							description: t("devices.wifiDesc"),
						},
						{
							href: "/profile/github",
							title: t("nav.github"),
							description: t("devices.githubDesc"),
						},
						{
							href: "/devices/notifications",
							title: t("devices.pairingRequests"),
							description: t("devices.pairingRequestsDesc"),
						},
						{
							href: "/devices/debug",
							title: t("devices.debugStream"),
							description: t("devices.debugStreamDesc"),
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
				<DialogTitle>{t("devices.addBoard")}</DialogTitle>
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
						{t("devices.close")}
					</Button>
				</DialogActions>
			</Dialog>
		</Stack>
	);
}
