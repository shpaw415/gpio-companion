import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import {
	type BoardView,
	deviceDisplayName,
	listDeviceStatus,
	openExternal,
	t3AppUrl,
} from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { T3_FRAME_SLOT_ID } from "./T3Frame";

export default function T3() {
	const { uuid, setUuid } = useBoardSelection();
	const [boards, setBoards] = useState<BoardView[]>([]);

	useEffect(() => {
		void listDeviceStatus()
			.then((result) => {
				setBoards(result.devices);
				if (
					result.devices.length > 0 &&
					!result.devices.some((board) => board.device.uuid === uuid)
				) {
					setUuid(result.devices[0]?.device.uuid ?? "");
				}
			})
			.catch(() => undefined);
	}, [setUuid, uuid]);

	return (
		<Stack
			spacing={1}
			sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
		>
			<Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
				<Typography variant="h5" Element="h1" sx={{ flexGrow: 1 }}>
					T3 Code
				</Typography>
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
				<Button
					variant="text"
					disabled={!uuid}
					onClick={() => void openExternal(t3AppUrl(uuid))}
				>
					Open in browser
				</Button>
			</Stack>
			{uuid ? (
				<div
					id={T3_FRAME_SLOT_ID}
					style={{ flex: 1, minHeight: 480, width: "100%" }}
				/>
			) : (
				<Typography color="secondary">
					Pair a board to embed T3 Code.
				</Typography>
			)}
		</Stack>
	);
}
