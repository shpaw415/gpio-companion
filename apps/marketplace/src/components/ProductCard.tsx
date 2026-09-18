import Button from "@shpaw415/mui-lite/Button";
import Card, { CardActions, CardContent } from "@shpaw415/mui-lite/Card";
import Chip from "@shpaw415/mui-lite/Chip";
import Typography from "@shpaw415/mui-lite/Typography";
import type { ReactNode } from "react";
import { useCart } from "../hooks/useCart.tsx";
import { useT } from "../hooks/useLocale.tsx";
import { ArrowIcon, CartIcon } from "./icons.tsx";
import KitIllustration, {
	type KitIllustrationProps,
} from "./KitIllustration.tsx";
import Price from "./Price.tsx";

export type ProductCardProduct = {
	id: string;
	slug?: string;
	name: string;
	description: string;
	price: number;
	currency?: string;
	compareAt?: number;
	badge?: "new" | "featured" | string;
	inStock?: boolean;
	illustration?: KitIllustrationProps["variant"];
};

export type ProductCardProps = {
	product: ProductCardProduct;
	illustration?: ReactNode;
	onAdd?: (product: ProductCardProduct) => void;
};

export default function ProductCard({
	product,
	illustration,
	onAdd,
}: ProductCardProps) {
	const t = useT();
	const cart = useCart();
	const inStock = product.inStock !== false;
	const badge =
		product.badge === "new"
			? t("product.new")
			: product.badge === "featured"
				? t("product.featured")
				: product.badge;
	const href = `/kits/${product.slug ?? product.id}`;
	return (
		<Card className="market-product-card" variant="outlined">
			<a
				href={href}
				className="market-product-visual"
				tabIndex={-1}
				aria-label={product.name}
			>
				{illustration ?? (
					<KitIllustration variant={product.illustration} title="" />
				)}
				{badge ? (
					<Chip size="small" color="secondary">
						{badge}
					</Chip>
				) : null}
			</a>
			<CardContent className="market-product-content">
				<Typography variant="overline" color={inStock ? "success" : "error"}>
					{inStock ? t("product.inStock") : t("product.outOfStock")}
				</Typography>
				<a href={href}>
					<Typography variant="h5" component="h2">
						{product.name}
					</Typography>
				</a>
				<Typography color="textSecondary">{product.description}</Typography>
				<Price
					amount={product.price}
					currency={product.currency}
					compareAt={product.compareAt}
				/>
			</CardContent>
			<CardActions className="market-product-actions">
				<Button href={href} variant="text" endIcon={<ArrowIcon />}>
					{t("action.viewKit")}
				</Button>
				<Button
					variant="contained"
					startIcon={<CartIcon />}
					disabled={!inStock}
					onClick={() => {
						cart.add(product.id);
						onAdd?.(product);
					}}
				>
					{t("action.addToCart")}
				</Button>
			</CardActions>
		</Card>
	);
}
