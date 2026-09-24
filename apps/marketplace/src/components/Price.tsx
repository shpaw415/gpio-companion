import Typography from "@shpaw415/mui-lite/Typography";
import { useLocale } from "../hooks/useLocale.tsx";
import { formatPrice } from "../lib/format.ts";

export type PriceProps = {
	amount: number;
	currency?: string;
	compareAt?: number;
	className?: string;
};

export default function Price({
	amount,
	currency = "USD",
	compareAt,
	className,
}: PriceProps) {
	const { locale } = useLocale();
	return (
		<div className={`market-price ${className ?? ""}`}>
			<Typography variant="h5" component="span">
				{formatPrice(amount, currency, locale)}
			</Typography>
			{compareAt && compareAt > amount ? (
				<del>{formatPrice(compareAt, currency, locale)}</del>
			) : null}
		</div>
	);
}
