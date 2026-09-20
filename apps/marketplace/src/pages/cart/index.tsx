import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Table, {
	TableBody,
	TableCell,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import Typography from "@shpaw415/mui-lite/Typography";
import EmptyState from "../../components/EmptyState.tsx";
import QuantityControl from "../../components/QuantityControl.tsx";
import { useCart } from "../../hooks/useCart.tsx";
import { useT } from "../../hooks/useLocale.tsx";
import { getCatalogItem } from "../../lib/demo-catalog.ts";

export default function CartPage() {
	const t = useT();
	const cart = useCart();
	const rows = cart.items
		.map((item) => ({ item, product: getCatalogItem(item.id) }))
		.filter((row) => row.product);

	if (rows.length === 0) {
		return (
			<EmptyState
				title={t("cart.emptyTitle")}
				description={t("cart.emptyBody")}
				actionLabel={t("action.browseKits")}
				actionHref="/kits"
			/>
		);
	}

	return (
		<div>
			<Typography variant="h4" component="h1">
				{t("cart.title")} · {t("cart.count", { count: cart.count })}
			</Typography>
			<Paper className="market-table-shell" variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>{t("catalog.kit")}</TableCell>
							<TableCell>{t("catalog.quantity")}</TableCell>
							<TableCell>{t("catalog.price")}</TableCell>
							<TableCell />
						</TableRow>
					</TableHead>
					<TableBody>
						{rows.map(({ item, product }) => (
							<TableRow key={item.id}>
								<TableCell>
									{product?.sku} · {t("catalog.tbd")}
								</TableCell>
								<TableCell>
									<QuantityControl
										value={item.quantity}
										label=""
										onChange={(next) => cart.update(item.id, next)}
									/>
								</TableCell>
								<TableCell>{t("catalog.tbd")}</TableCell>
								<TableCell>
									<Button variant="text" onClick={() => cart.remove(item.id)}>
										{t("action.remove")}
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Paper>
			<div className="market-totals market-table-shell">
				<div className="row">
					<span>{t("cart.subtotal")}</span>
					<span>{t("catalog.tbd")}</span>
				</div>
				<div className="row">
					<span>{t("cart.shipping")}</span>
					<span>{t("catalog.tbd")}</span>
				</div>
				<div className="row grand">
					<span>{t("cart.total")}</span>
					<span>{t("catalog.tbd")}</span>
				</div>
				<Typography variant="body2" color="textSecondary">
					{t("cart.checkoutDisabled")}
				</Typography>
				<Button variant="contained" disabled>
					{t("cart.checkout")}
				</Button>
				<Button variant="text" onClick={() => cart.clear()}>
					{t("action.clearCart")}
				</Button>
			</div>
		</div>
	);
}
