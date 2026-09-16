import { encode } from "uqr";
import { useT } from "../hooks/useLocale.tsx";

export default function QrCode({
	value,
	label,
}: {
	value: string;
	label?: string;
}) {
	const t = useT();
	const caption = label ?? t("t3.qrDefault");
	const { data, size } = encode(value, { ecc: "M", border: 2 });
	const modules = data.flatMap((row, y) =>
		row.flatMap((dark, x) => (dark ? [`${x},${y}`] : [])),
	);
	return (
		<svg
			role="img"
			aria-label={caption}
			viewBox={`0 0 ${size} ${size}`}
			width={180}
			height={180}
			className="rounded bg-white text-black"
		>
			<title>{caption}</title>
			<rect width={size} height={size} fill="white" />
			{modules.map((cell) => {
				const [x, y] = cell.split(",");
				return (
					<rect key={cell} x={x} y={y} width="1" height="1" fill="black" />
				);
			})}
		</svg>
	);
}
