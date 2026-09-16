import WifiBleForm from "@components/WifiBleForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { SectionHeader } from "../../components/Section.tsx";
import { useT } from "../../hooks/useLocale.tsx";

export default function WifiPage() {
	const t = useT();
	return (
		<Stack spacing={3}>
			<SectionHeader title={t("wifi.title")} />
			<Typography color="secondary">{t("wifi.webHint")}</Typography>
			<WifiBleForm />
		</Stack>
	);
}
