import { describe, expect, it } from "vitest";
import { ensureDecoratorMetadataSymbol } from "../../lib/decorators/decorator-metadata-symbol.js";

describe("Decorator metadata symbol", () => {
	it("should not replace an existing Symbol.metadata value", () => {
		const metadata = ensureDecoratorMetadataSymbol();

		expect(ensureDecoratorMetadataSymbol()).toBe(metadata);
		expect(Symbol.metadata).toBe(metadata);
	});
});
