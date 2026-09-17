import { useEffect, useRef, useState } from "react";
import { Clipboard, ScrollView, Text } from "react-native";
import { useColors } from "../lib/color-mode.tsx";
import { useT } from "../lib/locale.tsx";
import { Paper, TextButton } from "./ui.tsx";

export default function LiveConsole({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	const t = useT();
	const colors = useColors();
	const scrollRef = useRef<ScrollView>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (value.length >= 0) {
			scrollRef.current?.scrollToEnd({ animated: false });
		}
	}, [value]);

	if (!value) {
		return null;
	}

	function copy() {
		Clipboard.setString(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<Paper>
			<Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
			<ScrollView
				ref={scrollRef}
				nestedScrollEnabled
				style={{ maxHeight: 192 }}
			>
				<Text
					selectable
					style={{
						color: colors.text,
						fontFamily: "monospace",
						fontSize: 12,
					}}
				>
					{value}
				</Text>
			</ScrollView>
			<TextButton
				label={copied ? t("common.copied") : t("common.copy")}
				onPress={copy}
			/>
		</Paper>
	);
}
