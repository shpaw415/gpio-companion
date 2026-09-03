import NotificationCenter from "@components/NotificationCenter";
import Stack from "@shpaw415/mui-lite/Stack";
import { SectionHeader } from "../../components/Section.tsx";

export default function NotificationsPage() {
	return (
		<Stack spacing={3}>
			<SectionHeader title="Notifications" />
			<NotificationCenter />
		</Stack>
	);
}