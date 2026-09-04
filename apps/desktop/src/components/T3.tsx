import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { deviceDisplayName, openExternal, t3AppUrl } from "../api";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { SelectSkeleton } from "./skeletons";
import { T3_FRAME_SLOT_ID } from "./T3Frame";

export default function T3() {
	const { uuid, setUuid } = useBoardSelection();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const { boards, loading } = useUserBoards();
	const chromeRef = useRef<HTMLDivElement>(null);
	const [slotTop, setSlotTop] = useState(0);

	useEffect(() => {
		if (
			boards.length > 0 &&
			!boards.some((board) => board.device.uuid === uuidRef.current)
		) {
			setUuid(boards[0]?.device.uuid ?? "");
		}
	}, [boards, setUuid]);

	useLayoutEffect(() => {
		const sync = () => {
			const chrome = chromeRef.current;
			if (!chrome) {
				return;
			}
			setSlotTop(chrome.getBoundingClientRect().bottom);
		};
		sync();
		window.addEventListener("resize", sync);
		return () => window.removeEventListener("resize", sync);
	}, [loading]);

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
			<div ref={chromeRef}>
				<Stack
					direction="row"
					spacing={1}
					sx={{ alignItems: "center", flexShrink: 0, px: 0.5, py: 0.5 }}
				>
					<Typography
						variant="subtitle1"
						Element="h1"
						sx={{ flexGrow: 1 }}
						noWrap
					>
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
			</div>
			{loading ? null : uuid ? (
				<div
					id={T3_FRAME_SLOT_ID}
					style={{
						position: "fixed",
						top: slotTop,
						left: 0,
						right: 0,
						bottom: 0,
						width: "100%",
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
