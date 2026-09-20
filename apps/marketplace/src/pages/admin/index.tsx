import Button from "@shpaw415/mui-lite/Button";
import Card, { CardActions, CardContent } from "@shpaw415/mui-lite/Card";
import Typography from "@shpaw415/mui-lite/Typography";
import AdminSection from "../../components/AdminSection.tsx";
import { useT } from "../../hooks/useLocale.tsx";

export default function AdminOverviewPage() {
	const t = useT();
	const sections = [
		{
			href: "/admin/products",
			title: t("admin.products"),
			body: "Draft, publish, archive. Bilingual content, price, SKU, image order.",
		},
		{
			href: "/admin/inventory",
			title: t("admin.inventory"),
			body: "Stock adjustments with reasons and immutable history.",
		},
		{
			href: "/admin/orders",
			title: t("admin.orders"),
			body: "Payment state, processing / shipped transitions, carrier, tracking.",
		},
		{
			href: "/admin/shipping",
			title: t("admin.shipping"),
			body: "Active USD flat rates by country and optional region.",
		},
		{
			href: "/admin/policies",
			title: t("admin.policies"),
			body: "Bilingual draft editing and explicit publication.",
		},
	];
	return (
		<AdminSection value="overview">
			<Typography variant="h4" component="h1">
				{t("admin.overview")}
			</Typography>
			<div className="market-admin-cards">
				{sections.map((section) => (
					<Card key={section.href} variant="outlined">
						<CardContent>
							<Typography variant="h6" component="h2">
								{section.title}
							</Typography>
							<Typography color="textSecondary">{section.body}</Typography>
						</CardContent>
						<CardActions>
							<Button href={section.href} variant="text">
								{section.title} →
							</Button>
						</CardActions>
					</Card>
				))}
			</div>
		</AdminSection>
	);
}
