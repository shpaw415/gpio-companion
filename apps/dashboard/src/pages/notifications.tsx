import NotificationCenter from "@components/NotificationCenter";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function NotificationsPage() {
	return (
		<Stack spacing={3}>
			<Typography variant="h4" Element="h1">
				Notifications
			</Typography>
			<NotificationCenter />
		</Stack>
	);
}
