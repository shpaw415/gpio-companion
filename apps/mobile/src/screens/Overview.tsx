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
import { useDashboardMode } from "../lib/dashboard-mode.tsx";
import { useDeviceHub } from "../lib/device-hub.tsx";
import { translateError, useT } from "../lib/locale.tsx";

export default function Overview() {
	const auth = useAuth();
	const t = useT();
	const { isEasy } = useDashboardMode();
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
			<Title>
				{isEasy ? t("devices.titleEasy") : t("devices.titleExpert")}
			</Title>
			<ErrorText>{translateError(t, error || loadError || "")}</ErrorText>
			{loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : boards.length === 0 ? (
				<>
					<Muted>{t("devices.noBoardsYetBle")}</Muted>
					<PrimaryButton
						label={t("devices.pairADevice")}
						onPress={() => setTab("pair")}
					/>
				</>
			) : (
				<>
					<PrimaryButton
						label={t("devices.addBoard")}
						onPress={() => setTab("pair")}
					/>
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
