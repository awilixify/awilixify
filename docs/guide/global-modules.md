# Global Modules

Global modules let you register shared exports and shared pre-handlers once and make them available to all modules without explicit imports.
Augment global types to make them shared.

```typescript
import {
  createStaticModule,
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
  exportKeys: ["logger"];
  exportQueryPreHandlerKeys: ["auth"];
  exportCommandPreHandlerKeys: ["audit"];
}>;

export const GlobalModule = createStaticModule<GlobalModuleDef>({
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
  exports: {
    logger: Logger,
  },
  queryPreHandlerExports: {
    auth: AuthPreHandler,
  },
  commandPreHandlerExports: {
    audit: AuditPreHandler,
  },
});

declare module "awilixify" {
  interface GlobalDependencies extends InferGlobalDependencies<GlobalModuleDef> {}
  interface GlobalQueryPreHandlers extends InferGlobalQueryPreHandlers<GlobalModuleDef> {}
  interface GlobalCommandPreHandlers extends InferGlobalCommandPreHandlers<GlobalModuleDef> {}
}
```

Use global modules for cross-cutting infrastructure dependencies (app instance, logger, config, pre-handlers) that should be accessible in every module.
