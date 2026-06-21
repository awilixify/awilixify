type SymbolWithDecoratorMetadata = SymbolConstructor & {
	metadata?: symbol;
};

export function ensureDecoratorMetadataSymbol(): symbol | undefined {
	if (typeof Symbol !== "function") return undefined;

	const SymbolConstructor = Symbol as SymbolWithDecoratorMetadata;

	if (SymbolConstructor.metadata) {
		return SymbolConstructor.metadata;
	}

	const metadata = SymbolConstructor("Symbol.metadata");

	Object.defineProperty(SymbolConstructor, "metadata", {
		configurable: true,
		value: metadata,
	});

	return metadata;
}

ensureDecoratorMetadataSymbol();
