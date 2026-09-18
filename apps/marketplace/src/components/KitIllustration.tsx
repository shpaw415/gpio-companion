export type KitIllustrationProps = {
	variant?: "starter" | "sensor" | "motion" | "maker";
	className?: string;
	title?: string;
};

export default function KitIllustration({
	variant = "starter",
	className = "",
	title = "Electronics kit illustration",
}: KitIllustrationProps) {
	const accents = {
		starter: ["#2fc6b4", "#ffc857"],
		sensor: ["#56c8e8", "#f7a65a"],
		motion: ["#e9b949", "#5cd6c7"],
		maker: ["#68d391", "#ff9f6e"],
	}[variant];
	return (
		<svg
			className={`kit-illustration ${className}`}
			viewBox="0 0 560 360"
			role="img"
			aria-label={title}
		>
			<defs>
				<linearGradient id={`board-${variant}`} x1="0" y1="0" x2="1" y2="1">
					<stop stopColor="#193a36" />
					<stop offset="1" stopColor="#0e2624" />
				</linearGradient>
				<filter
					id={`shadow-${variant}`}
					x="-20%"
					y="-20%"
					width="140%"
					height="160%"
				>
					<feDropShadow dx="0" dy="16" stdDeviation="14" floodOpacity=".2" />
				</filter>
			</defs>
			<path
				className="kit-trace"
				d="M20 80h86l34 34h65M412 52v46l-31 31h-49M32 288h88l35-35h50M532 256h-74l-40-40h-45"
			/>
			<g filter={`url(#shadow-${variant})`}>
				<rect
					x="112"
					y="72"
					width="336"
					height="218"
					rx="27"
					fill={`url(#board-${variant})`}
				/>
				<rect
					x="130"
					y="90"
					width="300"
					height="182"
					rx="17"
					fill="none"
					stroke={accents[0]}
					strokeOpacity=".45"
				/>
				<path
					d="M166 126h86v34h54v-28h78M166 232h58v-34h84v28h76"
					fill="none"
					stroke={accents[0]}
					strokeWidth="4"
					strokeLinecap="round"
				/>
				<rect
					x="238"
					y="143"
					width="90"
					height="70"
					rx="10"
					fill="#071815"
					stroke={accents[1]}
					strokeWidth="3"
				/>
				{[0, 1, 2, 3, 4].map((pin) => (
					<g key={pin} fill={accents[1]}>
						<rect x={226} y={150 + pin * 13} width="12" height="5" rx="2" />
						<rect x={328} y={150 + pin * 13} width="12" height="5" rx="2" />
					</g>
				))}
				<circle cx="166" cy="126" r="9" fill={accents[1]} />
				<circle cx="384" cy="132" r="9" fill={accents[0]} />
				<circle cx="166" cy="232" r="9" fill={accents[0]} />
				<circle cx="384" cy="226" r="9" fill={accents[1]} />
				<rect x="153" y="165" width="50" height="30" rx="6" fill="#dbe8e3" />
				<path
					d="M163 180h30"
					stroke="#1b5b53"
					strokeWidth="5"
					strokeDasharray="4 5"
				/>
			</g>
			{[98, 138, 178, 218, 258].map((x) => (
				<circle key={x} cx={x} cy="316" r="4" fill={accents[1]} />
			))}
			<path d="M278 290v27h-60M343 290v44h79" className="kit-trace" />
		</svg>
	);
}
