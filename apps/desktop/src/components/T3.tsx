import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import {
	type BoardView,
	deviceDisplayName,
	listDeviceStatus,
	openExternal,
	t3AppUrl,
} from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { SelectSkeleton } from "./skeletons";
import { T3_FRAME_SLOT_ID } from "./T3Frame";

export default function T3() {
	const { uuid, setUuid } = useBoardSelection();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const [boards, setBoards] = useState<BoardView[]>([]);
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
			.catch(() => undefined)
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
		<Stack
			spacing={0.5}
			sx={{
				flex: 1,
				minHeight: 0,
				height: "100%",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			<Stack
				direction="row"
				spacing={1}
				sx={{ alignItems: "center", flexShrink: 0, px: 0.5, py: 0.5 }}
			>
				<Typography variant="subtitle1" Element="h1" sx={{ flexGrow: 1 }} noWrap>
					T3 Code
				</Typography>
				{loading ? (
					<SelectSkeleton />
				) : (
					<Select
						name="board"
						label="Board"
						value={uuid}
						onSelect={setUuid}
						disabled={boards.length === 0}
						sx={{ minWidth: 240 }}
					>
						{boards.map((board) => (
							<option key={board.device.uuid} value={board.device.uuid}>
								{deviceDisplayName(board.device)}
							</option>
						))}
					</Select>
				)}
				<Button
					variant="text"
					disabled={!uuid}
					onClick={() => void openExternal(t3AppUrl(uuid))}
				>
					Open in browser
				</Button>
			</Stack>
			{loading ? null : uuid ? (
				<div
					id={T3_FRAME_SLOT_ID}
					style={{
						flex: 1,
						minHeight: 0,
						width: "100%",
						height: "100%",
					}}
				/>
			) : (
				<Typography color="secondary">
					Pair a board to embed T3 Code.
				</Typography>
			)}
		</Stack>
	);
}
