import { createDecoratorStateUpdater } from "../decorators/decorator-state.js";
import type {
	DecoratorState,
	DecoratorToken,
} from "../decorators/decorator-state.types.js";

export type HttpOperationRef = {
	operationId: string;
	serviceName: string;
	transport: "http";
};

export type MessagingOperationRef = {
	serviceName: string;
	transport: "messaging";
	type: string;
};

export type OperationRef = HttpOperationRef | MessagingOperationRef;
export type MessagingOperationInput = Omit<MessagingOperationRef, "transport">;
export type LocalMessagingOperationRef = Omit<
	MessagingOperationRef,
	"serviceName"
>;
export type LocalMessagingOperationInput = Pick<MessagingOperationRef, "type">;

export interface OperationCallDecoratorState
	extends DecoratorState<OperationRef[]> {}

export interface OperationPublishDecoratorState
	extends DecoratorState<LocalMessagingOperationRef[]> {}

const callState = createDecoratorStateUpdater("operation-calls", {
	method: (): OperationRef[] => [],
});

const publishState = createDecoratorStateUpdater("operation-publications", {
	method: (): LocalMessagingOperationRef[] => [],
});

export const OPERATION_CALL_DECORATOR_STATE_TOKEN: DecoratorToken<OperationCallDecoratorState> =
	callState.token;

export const OPERATION_PUBLISH_DECORATOR_STATE_TOKEN: DecoratorToken<OperationPublishDecoratorState> =
	publishState.token;

export function callsOperation(
	operation: HttpOperationRef | MessagingOperationInput,
) {
	const operationRef: OperationRef =
		"operationId" in operation
			? operation
			: { ...operation, transport: "messaging" };

	return <This, Args extends unknown[], Result>(
		_target: (this: This, ...args: Args) => Result,
		context: ClassMethodDecoratorContext<
			This,
			(this: This, ...args: Args) => Result
		>,
	): void => {
		callState.update(
			context,
			{
				method: (operations) => [...operations, operationRef],
			},
			callsOperation.name,
		);
	};
}

export function publishesOperation(operation: LocalMessagingOperationInput) {
	const operationRef: LocalMessagingOperationRef = {
		...operation,
		transport: "messaging",
	};

	return <This, Args extends unknown[], Result>(
		_target: (this: This, ...args: Args) => Result,
		context: ClassMethodDecoratorContext<
			This,
			(this: This, ...args: Args) => Result
		>,
	): void => {
		publishState.update(
			context,
			{
				method: (operations) => [...operations, operationRef],
			},
			publishesOperation.name,
		);
	};
}
