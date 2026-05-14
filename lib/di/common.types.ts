export type UnknownRecord = Record<PropertyKey, unknown>;

declare const emptyObjectSymbol: unique symbol;
export type EmptyObject = { [emptyObjectSymbol]?: never };
