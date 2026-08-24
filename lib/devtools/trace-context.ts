import { AsyncLocalStorage } from "node:async_hooks";

export const AWILIXIFY_TRACE_CONTEXT_HEADER = "x-awilixify-trace-context";

export type TracePropagationContext = {
	traceId: string;
	spanId: string;
	traceFlags: string;
};

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const propagationStorage = new AsyncLocalStorage<TracePropagationContext>();

export function getTracePropagationContext():
	| TracePropagationContext
	| undefined {
	return propagationStorage.getStore();
}

export function runWithTracePropagationContext<T>(
	context: TracePropagationContext,
	callback: () => T | Promise<T>,
): T | Promise<T> {
	return propagationStorage.run(context, callback);
}

export function parseTraceparent(
	value: string | string[] | undefined,
): TracePropagationContext | undefined {
	const candidate = Array.isArray(value) ? value[0] : value;
	if (!candidate) return undefined;

	const match = TRACEPARENT_PATTERN.exec(candidate.trim());
	if (!match) return undefined;

	const traceId = match[1];
	const spanId = match[2];
	const traceFlags = match[3];
	if (!traceId || !spanId || !traceFlags) return undefined;
	if (isAllZeros(traceId) || isAllZeros(spanId)) return undefined;

	return {
		traceId: traceId.toLowerCase(),
		spanId: spanId.toLowerCase(),
		traceFlags: traceFlags.toLowerCase(),
	};
}

export function formatTraceparent(context: TracePropagationContext): string {
	return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

export function getTracePropagationHeaders(): Record<string, string> {
	const context = getTracePropagationContext();

	return context
		? { [AWILIXIFY_TRACE_CONTEXT_HEADER]: formatTraceparent(context) }
		: {};
}

export function runWithTraceparent<T>(
	value: string | string[] | undefined,
	callback: () => T | Promise<T>,
): T | Promise<T> {
	const context = parseTraceparent(value);

	return context
		? runWithTracePropagationContext(context, callback)
		: callback();
}

function isAllZeros(value: string): boolean {
	return /^0+$/.test(value);
}
