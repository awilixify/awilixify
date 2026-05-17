import { AsyncLocalStorage } from "node:async_hooks";

const requestSignalStorage = new AsyncLocalStorage<AbortSignal | undefined>();

export function runWithRequestSignal<T>(
	signal: AbortSignal | undefined,
	fn: () => T,
): T {
	return requestSignalStorage.run(signal, fn);
}

export function getRequestSignal(): AbortSignal | undefined {
	return requestSignalStorage.getStore();
}
