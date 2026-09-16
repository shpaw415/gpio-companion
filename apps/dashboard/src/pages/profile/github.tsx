import KeysForm from "@components/KeysForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { SectionHeader } from "../../components/Section.tsx";
import { useT } from "../../hooks/useLocale.tsx";

export default function ProfileGithubPage() {
	const t = useT();
	return (
		<Stack spacing={3}>
			<SectionHeader title={t("github.title")} />
			<Typography color="secondary">{t("github.pageHint")}</Typography>
			<KeysForm />
		</Stack>
	);
}
