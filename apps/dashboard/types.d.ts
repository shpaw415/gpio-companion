declare module "@cf-process-env.json" {
	const env: Record<string, string>;
	export default env;
}

declare module "*.md" {
	const content: string;
	export default content;
}
