import { greet } from "gpio-companion";

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
	port,
	fetch() {
		return new Response(greet("web"));
	},
});

console.log(`gpio-companion-web listening on http://localhost:${server.port}`);
