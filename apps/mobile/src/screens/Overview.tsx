import { useEffect, useRef, useState } from "react";
import BoardCard from "../components/BoardCard.tsx";
import {
	ErrorText,
	Muted,
	PrimaryButton,
	Screen,
	Skeleton,
	Title,
} from "../components/ui.tsx";
import { unpairDevice } from "../lib/api.ts";
import { useUserBoards } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { useDeviceHub } from "../lib/device-hub.tsx";

export default function Overview() {
	const auth = useAuth();
	const { setTab } = useDeviceHub();
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
		<Screen>
			<Title>Devices</Title>
			<ErrorText>{error || loadError}</ErrorText>
			{loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : boards.length === 0 ? (
				<>
					<Muted>No boards yet. Pair one nearby over Bluetooth.</Muted>
					<PrimaryButton label="Pair a device" onPress={() => setTab("pair")} />
				</>
			) : (
				<>
					<PrimaryButton label="Add board" onPress={() => setTab("pair")} />
					{boards.map((board) => (
						<BoardCard
							key={board.device.uuid}
							board={board}
							selected={board.device.uuid === uuid}
							onSelect={setUuid}
							onLabelSaved={(id, label) => patchLabel(id, label)}
							onUnpair={(id) => {
								if (!auth.token) {
									return;
								}
								void unpairDevice(auth.token, id)
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
		</Screen>
	);
}
