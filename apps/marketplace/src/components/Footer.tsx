import Typography from "@shpaw415/mui-lite/Typography";
import { useT } from "../hooks/useLocale.tsx";
import BrandMark from "./BrandMark.tsx";

export default function Footer() {
	const t = useT();
	return (
		<footer className="market-footer circuit-grid">
			<div className="market-footer-inner">
				<div className="market-footer-brand">
					<BrandMark />
					<Typography variant="h6">{t("brand.name")}</Typography>
					<Typography color="textSecondary">{t("footer.note")}</Typography>
				</div>
				<div>
					<Typography variant="overline">{t("footer.shop")}</Typography>
					<a href="/kits">{t("footer.kits")}</a>
					<a href="/orders">{t("footer.orders")}</a>
				</div>
				<div>
					<Typography variant="overline">{t("footer.support")}</Typography>
					<a href="/shipping">{t("footer.shipping")}</a>
					<a href="/contact">{t("footer.contact")}</a>
				</div>
			</div>
			<p className="market-footer-legal">
				© {new Date().getUTCFullYear()} gpio-companion. {t("footer.rights")}
			</p>
		</footer>
	);
}
