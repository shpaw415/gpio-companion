import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { translateError } from "gpio-companion-i18n";
import { useEffect, useRef, useState } from "react";
import { unpairDevice } from "../api";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { useT } from "../locale";
import BoardCard from "./BoardCard";
import DebugLog from "./DebugLog";
import { BoardCardSkeleton } from "./skeletons";

export default function Overview({ onAddBoard }: { onAddBoard?: () => void }) {
	const t = useT();
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
		<Stack spacing={1.5}>
			{shown ? <Alert severity="error">{shown}</Alert> : null}
			{shown ? <DebugLog error={shown} /> : null}
			{loading ? (
				<>
					<BoardCardSkeleton />
					<BoardCardSkeleton />
				</>
			) : boards.length === 0 ? (
				<>
					<Typography color="secondary">
						{t("devices.noBoardsYetBle")}
					</Typography>
					{onAddBoard ? (
						<Button variant="contained" size="small" onClick={onAddBoard}>
							{t("devices.pairADevice")}
						</Button>
					) : null}
				</>
			) : (
				<>
					{onAddBoard ? (
						<Stack direction="row" sx={{ justifyContent: "flex-end" }}>
							<Button variant="contained" size="small" onClick={onAddBoard}>
								{t("devices.addBoard")}
							</Button>
						</Stack>
					) : null}
					{boards.map((board) => (
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
											caught instanceof Error
												? caught.message
												: "unpair failed",
										);
									});
							}}
						/>
					))}
				</>
			)}
		</Stack>
	);
}
