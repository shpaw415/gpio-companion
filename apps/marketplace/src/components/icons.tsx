import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			width="24"
			height="24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{children}
		</svg>
	);
}

export function CartIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H6" />
			<circle cx="9" cy="20" r="1" />
			<circle cx="18" cy="20" r="1" />
		</Icon>
	);
}

export function MenuIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M4 7h16M4 12h16M4 17h16" />
		</Icon>
	);
}

export function CloseIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="m6 6 12 12M18 6 6 18" />
		</Icon>
	);
}

export function SunIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<circle cx="12" cy="12" r="3.5" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		</Icon>
	);
}

export function MoonIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M20 15.2A8.2 8.2 0 0 1 8.8 4 8.3 8.3 0 1 0 20 15.2Z" />
		</Icon>
	);
}

export function ArrowIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M5 12h14M14 7l5 5-5 5" />
		</Icon>
	);
}

export function LockIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<rect x="5" y="10" width="14" height="11" rx="2" />
			<path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
		</Icon>
	);
}
