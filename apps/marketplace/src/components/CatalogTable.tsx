import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Table, {
	TableBody,
	TableCell,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import Typography from "@shpaw415/mui-lite/Typography";
import { useMemo, useState } from "react";
import { useCart } from "../hooks/useCart.tsx";
import { useLocale, useT } from "../hooks/useLocale.tsx";
import { type DemoCatalogItem } from "../lib/demo-catalog.ts";
import KitIllustration from "./KitIllustration.tsx";
import QuantityControl from "./QuantityControl.tsx";
import TablePaginationShell, {
	type RowsPerPage,
} from "./TablePaginationShell.tsx";

export default function CatalogTable({ items }: { items: readonly DemoCatalogItem[] }) {
	const t = useT();
	const { locale } = useLocale();
	const cart = useCart();
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<"bench" | "name">("bench");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(10);
	const [quantities, setQuantities] = useState<Record<string, number>>({});

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const rows = items.filter((item) => {
			if (!q) return true;
			return `${item.nameEn} ${item.nameFr} ${item.sku} ${item.slug}`
				.toLowerCase()
				.includes(q);
		});
		return [...rows].sort((a, b) => {
			if (sort === "name") {
				const an = locale === "fr" ? a.nameFr : a.nameEn;
				const bn = locale === "fr" ? b.nameFr : b.nameEn;
				return an.localeCompare(bn);
			}
			return 0;
		});
	}, [items, query, sort, locale]);

	const visible = filtered.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	return (
		<div>
			<div className="toolbar market-catalog-toolbar">
				<input
					className="market-catalog-search"
					placeholder={t("catalog.search")}
					aria-label={t("catalog.searchLabel")}
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setPage(0);
					}}
				/>
				<span style={{ marginLeft: "auto" }} />
				<select
					aria-label="Sort"
					value={sort}
					onChange={(event) =>
						setSort(event.target.value === "name" ? "name" : "bench")
					}
				>
					<option value="bench">{t("catalog.sortBench")}</option>
					<option value="name">{t("catalog.sortName")}</option>
				</select>
			</div>
			<TablePaginationShell
				count={filtered.length}
				page={page}
				rowsPerPage={rowsPerPage}
				onPageChange={setPage}
				onRowsPerPageChange={(rows) => {
					setRowsPerPage(rows);
					setPage(0);
				}}
			>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell />
							<TableCell>{t("catalog.kit")}</TableCell>
							<TableCell>{t("catalog.status")}</TableCell>
							<TableCell>{t("catalog.price")}</TableCell>
							<TableCell>{t("catalog.stock")}</TableCell>
							<TableCell>{t("catalog.quantity")}</TableCell>
							<TableCell />
						</TableRow>
					</TableHead>
					<TableBody>
						{visible.map((item) => {
							const name = locale === "fr" ? item.nameFr : item.nameEn;
							const description =
								locale === "fr" ? item.descriptionFr : item.descriptionEn;
							const qty = quantities[item.id] ?? 1;
							return (
								<TableRow key={item.id}>
									<TableCell>
										<div className="thumb" aria-hidden="true">
											<KitIllustration variant={item.illustration} title="" />
										</div>
									</TableCell>
									<TableCell>
										<Typography variant="subtitle1" component="div">
											<a href={`/kits/${item.slug}`}>{name}</a>
										</Typography>
										<Typography variant="body2" color="textSecondary">
											{item.sku} · {description}
										</Typography>
									</TableCell>
									<TableCell>
										<Chip size="small" color="warning">
											{item.status === "draft"
												? t("catalog.draft")
												: t("catalog.unpublished")}
										</Chip>
									</TableCell>
									<TableCell>{t("catalog.tbd")}</TableCell>
									<TableCell>{t("catalog.tbd")}</TableCell>
									<TableCell>
										<QuantityControl
											value={qty}
											label=""
											onChange={(next) =>
												setQuantities((current) => ({
													...current,
													[item.id]: next,
												}))
											}
										/>
									</TableCell>
									<TableCell>
										<Button variant="contained" size="small" disabled>
											{t("action.addToCart")}
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TablePaginationShell>
			<p style={{ color: "var(--market-muted)", fontSize: ".85rem" }}>
				{t("catalog.subtitle")} {t("cart.checkoutDisabled")}
				{cart.count > 0 ? ` · ${t("cart.count", { count: cart.count })}` : ""}
			</p>
		</div>
	);
}
