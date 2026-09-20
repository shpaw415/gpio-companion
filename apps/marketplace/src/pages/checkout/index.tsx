import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stepper, { Step, StepLabel } from "@shpaw415/mui-lite/Stepper";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useT } from "../../hooks/useLocale.tsx";

export default function CheckoutPage() {
	const t = useT();
	return (
		<div>
			<Paper variant="outlined" className="market-steps">
				<Stepper activeStep={1}>
					<Step>
						<StepLabel>{t("checkout.stepsCart")}</StepLabel>
					</Step>
					<Step>
						<StepLabel>{t("checkout.stepsShipping")}</StepLabel>
					</Step>
					<Step>
						<StepLabel>{t("checkout.stepsCapture")}</StepLabel>
					</Step>
				</Stepper>
			</Paper>
			<div className="market-checkout-grid">
				<Paper variant="outlined" className="market-checkout-form">
					<Typography variant="h5" component="h1">
						{t("checkout.shippingTitle")}
					</Typography>
					<p className="market-notice is-warn">{t("checkout.draftBlocked")}</p>
					<div className="market-form-row">
						<TextField label={t("checkout.fullName")} placeholder="Ada Lovelace" />
						<TextField label={t("checkout.country")} placeholder="France" />
					</div>
					<TextField label={t("checkout.address")} placeholder="12 rue des Pins" />
					<TextField label={t("checkout.cityPostal")} placeholder="Paris 75011" />
					<p className="market-notice is-ok">{t("checkout.reservation")}</p>
				</Paper>
				<Paper variant="outlined" className="market-totals">
					<Typography variant="h6">{t("cart.summary")}</Typography>
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
					<Button variant="contained" disabled>
						{t("checkout.payDisabled")}
					</Button>
					<Button variant="text" href="/cart">
						{t("cart.backToCart")}
					</Button>
				</Paper>
			</div>
		</div>
	);
}
