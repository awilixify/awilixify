# Global Modules

Global modules let you register shared exports once and make them available to every module without explicit imports.

Typical use cases:

- app or framework instances
- config
- logger
- shared pre-handlers
- shared interceptors
- shared initializers

```typescript
import {
  createModule,
  type ModuleDef,
  type InferGlobalCommandPreHandlers,
  type InferGlobalDependencies,
  type InferGlobalQueryPreHandlers,
} from "awilixify";

import { AuthPreHandler } from "./auth.pre-handler";
import { AuditPreHandler } from "./audit.pre-handler";

export type GlobalModuleDef = ModuleDef<{
  providers: {
    logger: Logger;
  };
  queryPreHandlers: {
    auth: AuthPreHandler;
  };
  commandPreHandlers: {
    audit: AuditPreHandler;
  };
  exports: ["logger"];
  exportQueryPreHandlerKeys: ["auth"];
  exportCommandPreHandlerKeys: ["audit"];
}>;

export const GlobalModule = createModule<GlobalModuleDef>({
  name: "GlobalModule",
  providers: {
    logger: Logger,
  },
  queryPreHandlers: {
    auth: AuthPreHandler,
  },
  commandPreHandlers: {
    audit: AuditPreHandler,
  },
  exports: ["logger"],
  queryPreHandlerExports: ["auth"],
  commandPreHandlerExports: ["audit"],
});

declare module "awilixify" {
  interface GlobalDependencies extends InferGlobalDependencies<GlobalModuleDef> {}
  interface GlobalQueryPreHandlers extends InferGlobalQueryPreHandlers<GlobalModuleDef> {}
  interface GlobalCommandPreHandlers extends InferGlobalCommandPreHandlers<GlobalModuleDef> {}
}
```

## Interceptors And Initializers

Global modules are not limited to providers and pre-handlers.
Exported interceptors and exported initializers from a global module also become globally available.

That means you can define reusable behavior once in a global module and have it participate everywhere without importing the module explicitly in each feature module.

Use global modules for cross-cutting infrastructure and cross-cutting behavior that should be available application-wide.
