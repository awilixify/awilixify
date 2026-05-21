# Circular Dependencies

awilixify supports circular dependencies between providers and modules using `allowCircular` and `forwardRef`.

### Within Same Module

When providers in the same module depend on each other, use `allowCircular: true` on one provider.

```typescript
// dogs.service.ts
export class DogsService {
  constructor(private readonly catsService: Deps["catsService"]) {}
}

// cats.service.ts
export class CatsService {
  constructor(private readonly dogsService: Deps["dogsService"]) {}
}

// module.ts
export const AnimalModule = createModule<AnimalModuleDef>({
  name: "AnimalModule",
  providers: {
    dogsService: DogsService,
    catsService: {
      useClass: CatsService,
      allowCircular: true,
    },
  },
});
```

> [!NOTE]
> Unlike NestJS, no constructor-level annotations are needed in services.
> Circular handling stays at the module definition level.

### Between Modules

When modules import each other, use `forwardRef` and the `ModuleRef` type on the cyclic edges:

```typescript
// cats.module.ts
import { forwardRef, type ModuleRef } from "awilixify";
import { OwnersModule, type OwnersModuleDef } from "./owners.module";

export type CatsModuleDef = ModuleDef<{
  providers: {
    catsService: CatsService;
  };
  imports: [ModuleRef<OwnersModuleDef>];
  exportKeys: ["catsService"];
}>;

export const CatsModule = createModule<CatsModuleDef>({
  name: "CatsModule",
  imports: [forwardRef(() => OwnersModule)],
  providers: { catsService: CatsService },
  exports: { catsService: CatsService },
});

// owners.module.ts
import { forwardRef, type ModuleRef } from "awilixify";
import { CatsModule, type CatsModuleDef } from "./cats.module";

export type OwnersModuleDef = ModuleDef<{
  providers: { ownersService: OwnersService };
  imports: [ModuleRef<CatsModuleDef>];
}>;

export const OwnersModule: Module<OwnersModuleDef> =
  createModule<OwnersModuleDef>({
    name: "OwnersModule",
    imports: [forwardRef(() => CatsModule)],
    providers: { ownersService: OwnersService },
    exports: { ownersService: OwnersService },
  });
```

> [!IMPORTANT]
> If two module files import each other, prefer `forwardRef` on both sides of the module cycle.
> A direct import can work in one application entry order and fail in another, such as a focused test that boots the opposite module first.
> `forwardRef` delays reading the imported module export until awilixify resolves imports, which makes the cycle entry-order independent.

### Between Providers in Cyclic Modules

When providers from circularly dependent modules also depend on each other, combine both approaches:

```typescript
// cats.module.ts
export const CatsModule = createModule<CatsModuleDef>({
  name: "CatsModule",
  imports: [forwardRef(() => OwnersModule)],
  providers: {
    catsService: {
      useClass: CatsService,
      allowCircular: true,
    },
  },
  exports: {
    catsService: {
      useClass: CatsService,
      allowCircular: true,
    },
  },
});

// owners.module.ts
export const OwnersModule: Module<OwnersModuleDef> =
  createModule<OwnersModuleDef>({
    name: "OwnersModule",
    imports: [forwardRef(() => CatsModule)],
    providers: {
      ownersService: OwnersService,
    },
    exports: {
      ownersService: OwnersService,
    },
  });
```

> [!TIP]
> Prefer applying `allowCircular` to the minimal set of providers required to break the cycle.

> [!WARNING]
> Circular dependencies are supported, but they can indicate architectural issues.
> Consider extracting shared concerns into a third module when possible.
