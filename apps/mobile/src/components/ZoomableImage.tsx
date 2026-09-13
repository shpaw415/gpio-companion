import { useMemo, useRef, useState } from "react";
import {
	Dimensions,
	Image,
	Modal,
	PanResponder,
	Pressable,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ZoomableImage({
	uri,
	title,
	height = 180,
}: {
	uri: string;
	title: string;
	height?: number;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Pressable onPress={() => setOpen(true)}>
				<Image
					source={{ uri }}
					style={{
						width: "100%",
						height,
						backgroundColor: "#fff",
						borderRadius: 8,
					}}
					resizeMode="contain"
				/>
			</Pressable>
			<Modal
				animationType="fade"
				onRequestClose={() => setOpen(false)}
				visible={open}
			>
				<ZoomModal onClose={() => setOpen(false)} title={title} uri={uri} />
			</Modal>
		</>
	);
}

function ZoomModal({
	uri,
	title,
	onClose,
}: {
	uri: string;
	title: string;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const { width, height } = Dimensions.get("window");
	const scale = useRef(1);
	const pan = useRef({ x: 0, y: 0 });
	const last = useRef({ x: 0, y: 0 });
	const pinch = useRef<{ distance: number; scale: number } | null>(null);
	const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });

	const responder = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => true,
				onMoveShouldSetPanResponder: () => true,
				onPanResponderGrant: (event) => {
					const touches = event.nativeEvent.touches;
					if (touches.length >= 2) {
						const first = touches[0];
						const second = touches[1];
						pinch.current = {
							distance:
								Math.hypot(
									second.pageX - first.pageX,
									second.pageY - first.pageY,
								) || 1,
							scale: scale.current,
						};
						return;
					}
					pinch.current = null;
					last.current = { ...pan.current };
				},
				onPanResponderMove: (event, gesture) => {
					const touches = event.nativeEvent.touches;
					if (touches.length >= 2) {
						const first = touches[0];
						const second = touches[1];
						const distance =
							Math.hypot(
								second.pageX - first.pageX,
								second.pageY - first.pageY,
							) || 1;
						if (!pinch.current) {
							pinch.current = { distance, scale: scale.current };
						}
						const next = Math.min(
							8,
							Math.max(
								1,
								pinch.current.scale * (distance / pinch.current.distance),
							),
						);
						scale.current = next;
						setTransform({
							scale: next,
							x: pan.current.x,
							y: pan.current.y,
						});
						return;
					}
					const x = last.current.x + gesture.dx;
					const y = last.current.y + gesture.dy;
					pan.current = { x, y };
					setTransform({ scale: scale.current, x, y });
				},
				onPanResponderRelease: () => {
					pinch.current = null;
					last.current = { ...pan.current };
				},
			}),
		[],
	);

	return (
		<View style={{ flex: 1, backgroundColor: "#020617" }}>
			<View
				style={{
					paddingTop: insets.top + 8,
					paddingHorizontal: 16,
					paddingBottom: 8,
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<Text style={{ color: "#e2e8f0", fontWeight: "600" }}>{title}</Text>
				<Pressable onPress={onClose} style={{ paddingVertical: 8 }}>
					<Text style={{ color: "#8ab4f8", fontWeight: "600" }}>Close</Text>
				</Pressable>
			</View>
			<View style={{ flex: 1 }} {...responder.panHandlers}>
				<Image
					source={{ uri }}
					resizeMode="contain"
					style={{
						width,
						height: height - insets.top - 56,
						transform: [
							{ translateX: transform.x },
							{ translateY: transform.y },
							{ scale: transform.scale },
						],
					}}
				/>
			</View>
		</View>
	);
}
