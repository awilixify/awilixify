# Global Pre-Handler Inference

You can define global query/command pre-handlers once and have their context/errors inferred in all contracts:

```typescript
import type {
  InferGlobalCommandPreHandlers,
  InferGlobalQueryPreHandlers,
} from "awilixify";
import type { AppGlobalsModuleDef } from "./app-globals.module";

declare module "awilixify" {
  interface GlobalQueryPreHandlers extends InferGlobalQueryPreHandlers<AppGlobalsModuleDef> {}

  interface GlobalCommandPreHandlers extends InferGlobalCommandPreHandlers<AppGlobalsModuleDef> {}
}
```
