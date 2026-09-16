import Alert from "@shpaw415/mui-lite/Alert";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { translateError } from "gpio-companion-i18n";
import { useEffect, useRef, useState } from "react";
import { unpairDevice } from "../api";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { useDashboardMode } from "../hooks/useDashboardMode";
import { useT } from "../locale";
import BoardCard from "./BoardCard";
import DebugLog from "./DebugLog";
import { BoardCardSkeleton } from "./skeletons";

export default function Overview() {
	const t = useT();
	const { isEasy } = useDashboardMode();
	const { uuid, setUuid } = useBoardSelection();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const {
		boards,
		loading,
		error: loadError,
		removeBoard,
		patchLabel,
	} = useUserBoards();
	const [error, setError] = useState("");
	const shown = translateError(t, error || loadError);

	useEffect(() => {
		if (
			boards.length > 0 &&
			!boards.some((board) => board.device.uuid === uuidRef.current)
		) {
			setUuid(boards[0]?.device.uuid ?? "");
		}
	}, [boards, setUuid]);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				{t(isEasy ? "devices.titleEasy" : "devices.titleExpert")}
			</Typography>
			{shown ? <Alert severity="error">{shown}</Alert> : null}
			{shown ? <DebugLog error={shown} /> : null}
			{loading ? (
				<>
					<BoardCardSkeleton />
					<BoardCardSkeleton />
				</>
			) : boards.length === 0 ? (
				<Typography color="secondary">{t("devices.noBoardsYetBle")}</Typography>
			) : (
				boards.map((board) => (
					<BoardCard
						key={board.device.uuid}
						board={board}
						selected={board.device.uuid === uuid}
						onSelect={setUuid}
						onLabelSaved={(id, label) => patchLabel(id, label)}
						onUnpair={(id) => {
							void unpairDevice(id)
								.then(() => {
									removeBoard(id);
									if (uuid === id) {
										setUuid("");
									}
								})
								.catch((caught) => {
									setError(
										caught instanceof Error ? caught.message : "unpair failed",
									);
								});
						}}
					/>
				))
			)}
		</Stack>
	);
}
