export const InitHook = {
	OnInit: "onInit",
	AfterInit: "afterInit",
} as const;

export type InitHook = (typeof InitHook)[keyof typeof InitHook];

export const ShutdownHook = {
	BeforeShutdown: "beforeShutdown",
	OnShutdown: "onShutdown",
} as const;

export type ShutdownHook = (typeof ShutdownHook)[keyof typeof ShutdownHook];
