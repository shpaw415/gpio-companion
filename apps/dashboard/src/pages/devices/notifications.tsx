import NotificationCenter from "@components/NotificationCenter";
import Stack from "@shpaw415/mui-lite/Stack";
import { SectionHeader } from "../../components/Section.tsx";
import { useT } from "../../hooks/useLocale.tsx";

export default function NotificationsPage() {
	const t = useT();
	return (
		<Stack spacing={3}>
			<SectionHeader title={t("requests.title")} />
			<NotificationCenter />
		</Stack>
	);
}
