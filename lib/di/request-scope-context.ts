import { AsyncLocalStorage } from "node:async_hooks";
import type * as Awilix from "awilix";

type RequestScopeStore = Map<Awilix.AwilixContainer, Awilix.AwilixContainer>;

const requestScopeStorage = new AsyncLocalStorage<RequestScopeStore>();

export function runInRequestScopeContext<T>(fn: () => T): T {
	const existingStore = requestScopeStorage.getStore();

	if (existingStore) {
		return fn();
	}

	return requestScopeStorage.run(new Map(), fn);
}

export function hasRequestScopeContext(): boolean {
	return !!requestScopeStorage.getStore();
}

export function getOrCreateRequestScope(
	scope: Awilix.AwilixContainer,
): Awilix.AwilixContainer {
	const store = requestScopeStorage.getStore();

	if (!store) {
		return scope.createScope();
	}

	const existingScope = store.get(scope);

	if (existingScope) {
		return existingScope;
	}

	const requestScope = scope.createScope();
	store.set(scope, requestScope);

	return requestScope;
}

export function resolveFromRequestScope<T>(
	scope: Awilix.AwilixContainer,
	token: string | symbol,
): T {
	return getOrCreateRequestScope(scope).resolve<T>(token);
}
