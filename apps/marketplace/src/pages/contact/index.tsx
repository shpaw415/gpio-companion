import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import { useT } from "../../hooks/useLocale.tsx";

export default function ContactPage() {
	const t = useT();
	return (
		<Paper variant="outlined" className="market-policy">
			<Typography variant="h3" component="h1">
				{t("policies.contactTitle")}
			</Typography>
			<Typography color="textSecondary">{t("policies.contactBody")}</Typography>
			<div className="bar">
				<Button href="/policies" variant="contained">
					{t("footer.policies")}
				</Button>
				<Button href="/orders" variant="text">
					{t("footer.orders")}
				</Button>
			</div>
		</Paper>
	);
}
