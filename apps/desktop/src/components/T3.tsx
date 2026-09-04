import Button from "@shpaw415/mui-lite/Button";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef } from "react";
import { deviceDisplayName, openExternal, t3AppUrl } from "../api";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import { SelectSkeleton } from "./skeletons";

export default function T3() {
	const { uuid, setUuid } = useBoardSelection();
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const { boards, loading } = useUserBoards();

	useEffect(() => {
		if (
			boards.length > 0 &&
			!boards.some((board) => board.device.uuid === uuidRef.current)
		) {
			setUuid(boards[0]?.device.uuid ?? "");
		}
	}, [boards, setUuid]);

	return (
		<Stack spacing={0.5} sx={{ flexShrink: 0 }}>
			<div data-t3-chrome="">
				<Stack
					direction="row"
					spacing={1}
					sx={{ alignItems: "center", px: 0.5, py: 0.5 }}
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
			{loading || uuid ? null : (
				<Typography color="secondary">
					Pair a board to embed T3 Code.
				</Typography>
			)}
		</Stack>
	);
}
