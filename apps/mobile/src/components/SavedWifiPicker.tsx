import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "../lib/color-mode.tsx";
import {
	MANUAL_NETWORK,
	networkValue,
	type SavedNetwork,
} from "../lib/wifi-networks.ts";

export function SavedWifiPicker({
	networks,
	selectedId,
	onSelect,
	disabled,
}: {
	networks: SavedNetwork[];
	selectedId: string;
	onSelect: (id: string) => void;
	disabled?: boolean;
}) {
	const colors = useColors();
	const [open, setOpen] = useState(false);
	const options = [
		{ id: MANUAL_NETWORK, label: "Enter manually" },
		...networks.map((network) => ({
			id: networkValue(network.ssid),
			label: network.ssid,
		})),
	];
	const selected = options.find((option) => option.id === selectedId) ?? options[0];
	return (
		<View style={{ gap: 6 }}>
			<Text style={{ color: colors.text, fontWeight: "600" }}>Saved network</Text>
			<Pressable
				disabled={disabled}
				onPress={() => setOpen((current) => !current)}
				style={{
					backgroundColor: colors.surface,
					borderRadius: 12,
					padding: 12,
					borderWidth: 1,
					borderColor: colors.border,
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					opacity: disabled ? 0.6 : 1,
				}}
			>
				<Text style={{ color: colors.text, flex: 1 }}>{selected?.label}</Text>
				<Text style={{ color: colors.muted }}>{open ? "▲" : "▼"}</Text>
			</Pressable>
			{open ? (
				<View
					style={{
						backgroundColor: colors.surface,
						borderRadius: 12,
						borderWidth: 1,
						borderColor: colors.border,
						overflow: "hidden",
					}}
				>
					{options.map((option, index) => {
						const active = option.id === selectedId;
						return (
							<Pressable
								key={option.id}
								disabled={disabled}
								onPress={() => {
									onSelect(option.id);
									setOpen(false);
								}}
								style={{
									padding: 12,
									borderTopWidth: index === 0 ? 0 : 1,
									borderTopColor: colors.border,
									backgroundColor: active ? colors.chipBg : colors.surface,
								}}
							>
								<Text
									style={{
										color: active ? colors.primary : colors.text,
										fontWeight: active ? "600" : "400",
									}}
								>
									{option.label}
								</Text>
							</Pressable>
						);
					})}
				</View>
			) : null}
		</View>
	);
}
