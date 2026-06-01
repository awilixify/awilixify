import type { ConstructorController } from "../di/providers/provider.types.js";

export function getControllerMethodNames(
	controllerClass: ConstructorController,
): Array<string | symbol> {
	const collected = new Set<string | symbol>();
	let proto = controllerClass.prototype;

	while (proto && proto !== Object.prototype) {
		Object.getOwnPropertyNames(proto)
			.filter(
				(name) => name !== "constructor" && typeof proto[name] === "function",
			)
			.forEach((name) => {
				collected.add(name);
			});

		Object.getOwnPropertySymbols(proto)
			.filter((symbol) => typeof proto[symbol] === "function")
			.forEach((symbol) => {
				collected.add(symbol);
			});

		proto = Object.getPrototypeOf(proto);
	}

	return [...collected];
}
