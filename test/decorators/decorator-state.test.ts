import { describe, expect, it } from "vitest";
import {
	createDecoratorStateUpdater,
	resolveDecoratorState,
} from "../../lib/decorators/decorator-state.js";

const { token, update } = createDecoratorStateUpdater("instance-methods", {
	method: () => "method",
});

function mark(_target: any, context: ClassMethodDecoratorContext) {
	update(context, { method: () => "decorated" });
}

describe("decorator method validation", () => {
	it("rejects static methods during class definition", () => {
		expect(() => {
			class Service {
				@mark
				static run() {}

				value = 42;
			}
			return Service;
		}).toThrow('Cannot decorate static method "run"');
	});

	it("rejects JavaScript #private methods during class definition", () => {
		expect(() => {
			class Service {
				@mark
				#run() {}

				run() {
					return this.#run();
				}
			}
			return Service;
		}).toThrow('Cannot decorate #private method "#run"');
	});

	it("allows public, protected, and TypeScript-private instance methods", () => {
		class Service {
			@mark
			publicMethod() {
				return this.protectedMethod();
			}

			@mark
			protected protectedMethod() {
				return this.privateMethod();
			}

			@mark
			private privateMethod() {
				return 42;
			}
		}

		expect(new Service().publicMethod()).toBe(42);
		expect([
			...(resolveDecoratorState(Service, token)?.methods.keys() ?? []),
		]).toEqual(["publicMethod", "protectedMethod", "privateMethod"]);
	});
});
