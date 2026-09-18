export default function BrandMark({ compact = false }: { compact?: boolean }) {
	return (
		<span className="market-brand-mark" aria-hidden="true">
			<span className="market-brand-chip">
				<span />
				<span />
				<span />
				<span />
			</span>
			{compact ? null : <span className="market-brand-signal" />}
		</span>
	);
}
