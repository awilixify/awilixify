// Reject values JSON would silently alter, and sort object keys for stable fingerprints.
export function canonicalJson(
	value: unknown,
	ancestors = new Set<object>(),
): string {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "boolean"
	) {
		return JSON.stringify(value);
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return JSON.stringify(value);
	}

	if (typeof value !== "object" || value === null) {
		throw new TypeError("Idempotency fingerprints must be JSON-compatible");
	}

	if (ancestors.has(value)) throw new TypeError("Circular idempotency value");
	ancestors.add(value);

	try {
		if (Array.isArray(value)) {
			return `[${Array.from(value, (item) => canonicalJson(item, ancestors)).join(",")}]`;
		}

		const prototype = Object.getPrototypeOf(value);

		if (prototype !== Object.prototype && prototype !== null) {
			throw new TypeError(
				"Idempotency values must use plain objects, not class instances",
			);
		}

		if (Object.getOwnPropertySymbols(value).length) {
			throw new TypeError(
				"Idempotency values cannot contain symbol properties",
			);
		}
		const object = value as Record<string, unknown>;
		return `{${Object.keys(object)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${canonicalJson(object[key], ancestors)}`,
			)
			.join(",")}}`;
	} finally {
		ancestors.delete(value);
	}
}
