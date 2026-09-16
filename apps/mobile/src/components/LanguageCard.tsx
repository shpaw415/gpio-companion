import { Pressable, Text, View } from "react-native";
import { LOCALES } from "../../../packages/core/src/i18n/index.ts";
import { useColors } from "../lib/color-mode.tsx";
import { asLocale, useLocale } from "../lib/locale.tsx";
import { Body, Muted, Paper } from "./ui.tsx";

export default function LanguageCard() {
	const { locale, setLocale, t } = useLocale();
	const colors = useColors();

	return (
		<Paper>
			<Body>{t("language.title")}</Body>
			<Muted>{t("language.hint")}</Muted>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{LOCALES.map((entry) => {
					const selected = entry.code === locale;
					return (
						<Pressable
							key={entry.code}
							onPress={() => setLocale(asLocale(entry.code))}
							style={{
								paddingVertical: 8,
								paddingHorizontal: 14,
								borderRadius: 999,
								borderWidth: selected ? 2 : 1,
								borderColor: selected ? colors.primary : colors.border,
								backgroundColor: selected ? colors.primary : colors.surface,
							}}
						>
							<Text
								style={{
									color: selected ? colors.primaryText : colors.text,
									fontWeight: "600",
								}}
							>
								{entry.nativeLabel}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</Paper>
	);
}
