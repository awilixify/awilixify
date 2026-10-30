import * as Awilix from "awilix";
import { InquirerRequiresTransientLifetimeError } from "../errors.js";
import type { InquirerContext } from "./provider.types.js";

type ResolutionFrame = {
	consumer: InquirerContext;
	parent: InquirerContext;
};

export class InquirerResolverFactory {
	private currentFrame: ResolutionFrame | undefined;
	private enabled = false;

	enableTracking(): void {
		this.enabled = true;
	}

	private withConsumer<T>(consumer: InquirerContext, resolve: () => T): T {
		const previous = this.currentFrame;
		this.currentFrame = { consumer, parent: previous?.consumer };
		try {
			return resolve();
		} finally {
			this.currentFrame = previous;
		}
	}

	create<T extends object>(
		useClass: Awilix.Constructor<T>,
		options: Awilix.BuildResolverOptions<T> & { injectInquirer?: boolean },
	): Awilix.Resolver<T> {
		const { injectInquirer, ...resolverOptions } = options;

		if (injectInquirer && options.lifetime !== Awilix.Lifetime.TRANSIENT) {
			throw new InquirerRequiresTransientLifetimeError(useClass.name);
		}

		const baseResolver = Awilix.asClass(useClass, {
			...resolverOptions,
			...(injectInquirer && {
				// Contextual instances are intentionally retained by singleton consumers.
				isLeakSafe: resolverOptions.isLeakSafe ?? true,
				injector: (container: Awilix.AwilixContainer) => ({
					...resolverOptions.injector?.(container),
					inquirer: this.currentFrame?.parent,
				}),
			}),
		});

		return {
			...baseResolver,
			resolve: (container) => {
				if (!this.enabled) return baseResolver.resolve(container);

				const consumer = useClass.prototype;

				if (
					(resolverOptions.injectionMode ?? container.options.injectionMode) ===
					Awilix.InjectionMode.CLASSIC
				) {
					return this.withConsumer(consumer, () =>
						baseResolver.resolve(container),
					);
				}
				// PROXY injection can read dependencies after construction. Keep their
				// consumer attached to this cradle rather than the ambient frame.
				const cradle = new Proxy(container.cradle, {
					get: (target, key) =>
						this.withConsumer(consumer, () => Reflect.get(target, key)),
				});
				const contextualContainer = new Proxy(container, {
					get: (target, key) => {
						if (key === "cradle") return cradle;
						if (key === "resolve") {
							return (...args: Parameters<typeof container.resolve>) =>
								this.withConsumer(consumer, () => container.resolve(...args));
						}
						return Reflect.get(target, key);
					},
				});
				return this.withConsumer(consumer, () =>
					baseResolver.resolve(contextualContainer),
				);
			},
		};
	}
}
