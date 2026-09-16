import { Pressable, Text, View } from "react-native";
import { type NearbyRadio, nearbyBoardLabel } from "../lib/ble-frame.ts";
import { useColors } from "../lib/color-mode.tsx";
import { useT } from "../lib/locale.tsx";

export function NearbyPicker({
	boards,
	selectedId,
	onSelect,
	scanning,
	disabled,
}: {
	boards: NearbyRadio[];
	selectedId: string;
	onSelect: (id: string) => void;
	scanning: boolean;
	disabled?: boolean;
}) {
	const colors = useColors();
	const t = useT();
	return (
		<View style={{ gap: 8 }}>
			<Text style={{ color: colors.text, fontWeight: "600" }}>
				{t("ble.nearbyDevice")}
			</Text>
			{scanning ? (
				<Text style={{ color: colors.muted }}>{t("ble.scanning")}</Text>
			) : null}
			{!scanning && boards.length === 0 ? (
				<Text style={{ color: colors.muted }}>{t("ble.noNearby")}</Text>
			) : null}
			<View style={{ gap: 8 }}>
				{boards.map((board) => {
					const selected = board.id === selectedId;
					return (
						<Pressable
							key={board.id}
							disabled={disabled || scanning}
							style={{
								backgroundColor: colors.surface,
								borderRadius: 12,
								padding: 12,
								borderWidth: 1,
								borderColor: selected ? colors.primary : colors.border,
							}}
							onPress={() => onSelect(board.id)}
						>
							<Text
								style={{
									color: selected ? colors.primary : colors.text,
									fontWeight: selected ? "600" : "400",
								}}
							>
								{nearbyBoardLabel(board)}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}
