import { greet, VERSION } from "gpio-companion";

const command = process.argv[2] ?? "hello";

if (command === "version" || command === "-v" || command === "--version") {
	console.log(VERSION);
	process.exit(0);
}

console.log(greet("binary"));
