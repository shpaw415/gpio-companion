import { useEffect, useRef } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { deviceDisplayName } from "../lib/api.ts";
import { useUserBoards } from "../lib/api-cache.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { t3AppUrl } from "../lib/t3.ts";
import { Muted, Skeleton } from "../components/ui.tsx";

export default function T3() {
	const colors = useColors();
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
		<View style={{ gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
				<Text style={{ color: colors.text, fontWeight: "600", flexGrow: 1 }}>T3 Code</Text>
				{loading ? (
					<Skeleton height={36} />
				) : (
					<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
						{boards.map((board) => {
							const selected = board.device.uuid === uuid;
							return (
								<Pressable
									key={board.device.uuid}
									onPress={() => setUuid(board.device.uuid)}
									style={{
										borderWidth: 1,
										borderColor: selected ? colors.primary : colors.border,
										borderRadius: 999,
										paddingHorizontal: 10,
										paddingVertical: 6,
									}}
								>
									<Text style={{ color: selected ? colors.primary : colors.text }}>
										{deviceDisplayName(board.device)}
									</Text>
								</Pressable>
							);
						})}
					</View>
				)}
				<Pressable disabled={!uuid} onPress={() => void Linking.openURL(t3AppUrl(uuid))}>
					<Text style={{ color: colors.primary, fontWeight: "600" }}>Open in browser</Text>
				</Pressable>
			</View>
			{loading || uuid ? null : <Muted>Pair a board to embed T3 Code.</Muted>}
		</View>
	);
}
