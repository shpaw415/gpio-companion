import Button, { ButtonGroup } from "@shpaw415/mui-lite/Button";
import Typography from "@shpaw415/mui-lite/Typography";
import { useT } from "../hooks/useLocale.tsx";
import { MAX_CART_QUANTITY, MIN_CART_QUANTITY } from "../lib/cart.ts";

export type QuantityControlProps = {
	value: number;
	onChange: (quantity: number) => void;
	min?: number;
	max?: number;
	disabled?: boolean;
	label?: string;
};

export default function QuantityControl({
	value,
	onChange,
	min = MIN_CART_QUANTITY,
	max = MAX_CART_QUANTITY,
	disabled,
	label,
}: QuantityControlProps) {
	const t = useT();
	return (
		<div className="market-quantity">
			<Typography variant="caption" component="span">
				{label ?? t("product.quantity")}
			</Typography>
			<ButtonGroup className="market-quantity-buttons">
				<Button
					variant="outlined"
					size="small"
					disabled={disabled || value <= min}
					aria-label={t("product.decreaseQuantity")}
					onClick={() => onChange(Math.max(min, value - 1))}
				>
					−
				</Button>
				<output aria-live="polite">{value}</output>
				<Button
					variant="outlined"
					size="small"
					disabled={disabled || value >= max}
					aria-label={t("product.increaseQuantity")}
					onClick={() => onChange(Math.min(max, value + 1))}
				>
					+
				</Button>
			</ButtonGroup>
		</div>
	);
}
