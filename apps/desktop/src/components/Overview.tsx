import Alert from "@shpaw415/mui-lite/Alert";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import {
	type BoardView,
	listDeviceStatus,
	unpairDevice,
} from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";
import BoardCard from "./BoardCard";
import DebugLog from "./DebugLog";
import { BoardCardSkeleton } from "./skeletons";

export default function Overview() {
	const { uuid, setUuid } = useBoardSelection();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const [boards, setBoards] = useState<BoardView[]>([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		void listDeviceStatus()
			.then((result) => {
				if (cancelled) {
					return;
				}
				setBoards(result.devices);
				if (
					result.devices.length > 0 &&
					!result.devices.some(
						(board) => board.device.uuid === uuidRef.current,
					)
				) {
					setUuid(result.devices[0]?.device.uuid ?? "");
				}
			})
			.catch((caught) => {
				if (!cancelled) {
					setError(
						caught instanceof Error ? caught.message : "load failed",
					);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [setUuid]);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Devices
			</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
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
						onLabelSaved={(id, label) =>
							setBoards((current) =>
								current.map((item) =>
									item.device.uuid === id
										? {
												...item,
												device: { ...item.device, label },
											}
										: item,
								),
							)
						}
						onUnpair={(id) => {
							void unpairDevice(id)
								.then(() => {
									setBoards((current) =>
										current.filter((item) => item.device.uuid !== id),
									);
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
				))
			)}
		</Stack>
	);
}
