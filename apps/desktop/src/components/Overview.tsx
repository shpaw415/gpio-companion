import Alert from "@shpaw415/mui-lite/Alert";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import { unpairDevice } from "../api";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import BoardCard from "./BoardCard";
import DebugLog from "./DebugLog";
import { BoardCardSkeleton } from "./skeletons";

export default function Overview() {
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
				Devices
			</Typography>
			{error || loadError ? (
				<Alert severity="error">{error || loadError}</Alert>
			) : null}
			{error || loadError ? <DebugLog error={error || loadError} /> : null}
			{loading ? (
				<>
					<BoardCardSkeleton />
					<BoardCardSkeleton />
				</>
			) : boards.length === 0 ? (
				<Typography color="secondary">
					No boards yet. Pair one nearby.
				</Typography>
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
