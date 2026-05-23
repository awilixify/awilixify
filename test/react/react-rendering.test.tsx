/* @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Lifetime } from "awilix";
// biome-ignore lint/correctness/noUnusedImports: JSX in this test file is compiled against the React runtime binding.
import React, { memo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import * as ERRORS from "../../lib/react/errors.js";
import { ReactDIContext } from "../../lib/react/react-di-context.js";
import type {
  InferComponentDeps,
  ModuleDef,
  WithDeps,
  WithoutDeps,
} from "../../lib/react/react-module.types.js";
import { createModule } from "../../lib/react/react-module-factories.js";

type EmptyProps = Record<keyof any, never>;

afterEach(() => {
  cleanup();
});

describe("ReactDIContext rendering", () => {
  class GreetingService {
    format(name: string): string {
      return `Hello, ${name}`;
    }
  }

  it("renders wrapped components with normal props and injected deps", () => {
    function Greeting({ name, deps }: WithDeps<{ name: string }, AppDeps>) {
      return <p>{deps.greetingService.format(name)}</p>;
    }

    function Page({ deps }: WithDeps<EmptyProps, AppDeps>) {
      return <deps.Greeting name="Ralph" />;
    }

    const components = { Greeting, Page };
    type AppDef = ModuleDef<{
      providers: { greetingService: GreetingService };
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      providers: { greetingService: GreetingService },
      components,
    });

    const app = ReactDIContext.create(AppModule);
    const PageComponent = app.scope.resolve<WithoutDeps<typeof Page>>("Page");

    render(<PageComponent />);

    expect(screen.getByText("Hello, Ralph").textContent).toBe("Hello, Ralph");
  });

  it("keeps child hook state isolated when a deps component is toggled", () => {
    function Counter(_props: WithDeps<EmptyProps, AppDeps>) {
      const [count, setCount] = useState(0);

      return (
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          count:{count}
        </button>
      );
    }

    function Page({ deps }: WithDeps<EmptyProps, AppDeps>) {
      const [visible, setVisible] = useState(true);

      return (
        <section>
          <button type="button" onClick={() => setVisible((value) => !value)}>
            toggle
          </button>
          {visible ? <deps.Counter /> : null}
        </section>
      );
    }

    const components = { Counter, Page };
    type AppDef = ModuleDef<{
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      components,
    });

    const app = ReactDIContext.create(AppModule);
    const PageComponent = app.scope.resolve<WithoutDeps<typeof Page>>("Page");

    render(<PageComponent />);

    fireEvent.click(screen.getByText("count:0"));
    expect(screen.getByText("count:1").textContent).toBe("count:1");

    fireEvent.click(screen.getByText("toggle"));
    expect(screen.queryByText("count:1")).toBeNull();

    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByText("count:0").textContent).toBe("count:0");
  });

  it("preserves child hook state when the parent re-renders", () => {
    function Counter(_props: WithDeps<EmptyProps, AppDeps>) {
      const [count, setCount] = useState(0);

      return (
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          count:{count}
        </button>
      );
    }

    function Page({ deps }: WithDeps<EmptyProps, AppDeps>) {
      const [parentCount, setParentCount] = useState(0);

      return (
        <section>
          <button
            type="button"
            onClick={() => setParentCount((value) => value + 1)}
          >
            parent:{parentCount}
          </button>
          <deps.Counter />
        </section>
      );
    }

    const components = { Counter, Page };
    type AppDef = ModuleDef<{
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      components,
    });

    const app = ReactDIContext.create(AppModule);
    const PageComponent = app.scope.resolve<WithoutDeps<typeof Page>>("Page");

    render(<PageComponent />);

    fireEvent.click(screen.getByText("count:0"));
    expect(screen.getByText("count:1").textContent).toBe("count:1");

    fireEvent.click(screen.getByText("parent:0"));
    expect(screen.getByText("parent:1").textContent).toBe("parent:1");
    expect(screen.getByText("count:1").textContent).toBe("count:1");
  });

  it("renders React component objects such as memo components", () => {
    function Label({ value }: WithDeps<{ value: string }, AppDeps>) {
      return <span>{value}</span>;
    }

    const MemoLabel = memo(Label);

    function Page({ deps }: WithDeps<EmptyProps, AppDeps>) {
      return <deps.MemoLabel value="memo works" />;
    }

    const components = {
      MemoLabel: MemoLabel,
      Page,
    };
    type AppDef = ModuleDef<{
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      components,
    });

    const app = ReactDIContext.create(AppModule);
    const PageComponent = app.scope.resolve<WithoutDeps<typeof Page>>("Page");

    render(<PageComponent />);

    expect(screen.getByText("memo works").textContent).toBe("memo works");
  });

  it("renders components exported by imported modules", () => {
    function ExportedLabel({
      value,
    }: WithDeps<{ value: string }, FeatureDeps>) {
      return <span>{value}</span>;
    }

    const featureComponents = { ExportedLabel };
    type FeatureDef = ModuleDef<{
      components: typeof featureComponents;
      componentExportKeys: ["ExportedLabel"];
    }>;
    interface FeatureDeps extends InferComponentDeps<FeatureDef> {}

    const FeatureModule = createModule<FeatureDef>({
      name: "FeatureModule",
      components: featureComponents,
      componentExports: ["ExportedLabel"],
    });

    function Page({ deps }: WithDeps<EmptyProps, AppDeps>) {
      return <deps.ExportedLabel value="imported component works" />;
    }

    const components = { Page };
    type AppDef = ModuleDef<{
      imports: [typeof FeatureModule];
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      imports: [FeatureModule],
      components,
    });

    const app = ReactDIContext.create(AppModule);
    const PageComponent = app.scope.resolve<WithoutDeps<typeof Page>>("Page");

    render(<PageComponent />);

    expect(screen.getByText("imported component works").textContent).toBe(
      "imported component works",
    );
  });

  it("rejects manual deps prop overrides", () => {
    function Page(_props: WithDeps<EmptyProps, AppDeps>) {
      return <p>Page</p>;
    }

    const components = { Page };
    type AppDef = ModuleDef<{
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      components,
    });

    const app = ReactDIContext.create(AppModule);
    const PageComponent = app.scope.resolve<WithoutDeps<typeof Page>>("Page");

    expect(() =>
      render(<PageComponent {...({ deps: {} } as never)} />),
    ).toThrow(ERRORS.ComponentDepsOverrideError);
  });

  it("rejects local component names that conflict with provider names", () => {
    class SharedProvider {
      declare private readonly __brand: never;
    }

    function Shared(_props: WithDeps<EmptyProps, AppDeps>) {
      return null;
    }

    const components = { Shared };
    type AppDef = ModuleDef<{
      providers: { Shared: SharedProvider };
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      providers: { Shared: SharedProvider },
      components,
    });

    expect(() => ReactDIContext.create(AppModule)).toThrow(
      ERRORS.ComponentNameConflictError,
    );
  });

  it("rejects local components that conflict with imported component exports", () => {
    function ImportedShared(_props: WithDeps<EmptyProps, FeatureDeps>) {
      return null;
    }

    const featureComponents = { Shared: ImportedShared };
    type FeatureDef = ModuleDef<{
      components: typeof featureComponents;
      componentExportKeys: ["Shared"];
    }>;
    interface FeatureDeps extends InferComponentDeps<FeatureDef> {}

    const FeatureModule = createModule<FeatureDef>({
      name: "FeatureModule",
      components: featureComponents,
      componentExports: ["Shared"],
    });

    function LocalShared(_props: WithDeps<EmptyProps, AppDeps>) {
      return null;
    }

    const components = { Shared: LocalShared };
    type AppDef = ModuleDef<{
      imports: [typeof FeatureModule];
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      imports: [FeatureModule],
      components,
    });

    expect(() => ReactDIContext.create(AppModule)).toThrow(
      ERRORS.ComponentNameConflictError,
    );
  });

  it("rejects local components that conflict with global component exports", () => {
    function GlobalShared(_props: WithDeps<EmptyProps, GlobalDeps>) {
      return null;
    }

    const globalComponents = { Shared: GlobalShared };
    type GlobalDef = ModuleDef<{
      components: typeof globalComponents;
      componentExportKeys: ["Shared"];
    }>;
    interface GlobalDeps extends InferComponentDeps<GlobalDef> {}

    const GlobalModule = createModule<GlobalDef>({
      name: "GlobalModule",
      components: globalComponents,
      componentExports: ["Shared"],
    });

    function LocalShared(_props: WithDeps<EmptyProps, AppDeps>) {
      return null;
    }

    const components = { Shared: LocalShared };
    type AppDef = ModuleDef<{
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      components,
    });

    expect(() =>
      ReactDIContext.create(AppModule, { globalModules: [GlobalModule] }),
    ).toThrow(ERRORS.ComponentNameConflictError);
  });

  it("rejects local components that conflict with imported provider exports", () => {
    class SharedProvider {
      declare private readonly __brand: never;
    }

    type FeatureDef = ModuleDef<{
      providers: { Shared: SharedProvider };
      exportKeys: ["Shared"];
    }>;

    const FeatureModule = createModule<FeatureDef>({
      name: "FeatureModule",
      providers: {
        Shared: SharedProvider,
      },
      exports: ["Shared"],
    });

    function LocalShared(_props: WithDeps<EmptyProps, AppDeps>) {
      return null;
    }

    const components = { Shared: LocalShared };
    type AppDef = ModuleDef<{
      imports: [typeof FeatureModule];
      components: typeof components;
    }>;
    interface AppDeps extends InferComponentDeps<AppDef> {}

    const AppModule = createModule<AppDef>({
      name: "AppModule",
      imports: [FeatureModule],
      components,
    });

    expect(() => ReactDIContext.create(AppModule)).toThrow(
      ERRORS.ComponentNameConflictError,
    );
  });

  it("rejects component exports that are not declared by the imported module", () => {
    const FeatureModule = createModule({
      name: "FeatureModule",
      components: {},
      componentExports: ["Missing"],
    } as any);

    const AppModule = createModule({
      name: "AppModule",
      imports: [FeatureModule],
    } as any);

    expect(() => ReactDIContext.create(AppModule)).toThrow(
      ERRORS.InvalidComponentExportError,
    );
  });

  it("rejects duplicate component exports from imported modules", () => {
    function Shared(_props: WithDeps<EmptyProps, FeatureDeps>) {
      return null;
    }

    const featureComponents = { Shared };
    type FeatureDef = ModuleDef<{
      components: typeof featureComponents;
      componentExportKeys: ["Shared"];
    }>;
    interface FeatureDeps extends InferComponentDeps<FeatureDef> {}

    const FeatureModuleA = createModule<FeatureDef>({
      name: "FeatureModuleA",
      components: featureComponents,
      componentExports: ["Shared"],
    });
    const FeatureModuleB = createModule<FeatureDef>({
      name: "FeatureModuleB",
      components: featureComponents,
      componentExports: ["Shared"],
    });

    const AppModule = createModule({
      name: "AppModule",
      imports: [FeatureModuleA, FeatureModuleB],
    } as any);

    expect(() => ReactDIContext.create(AppModule)).toThrow(
      ERRORS.ComponentNameConflictError,
    );
  });

  it("resolves useClass providers without interceptor processing", () => {
    class ValueService {
      readonly value = "useClass";
    }

    const AppModule = createModule({
      name: "AppModule",
      providers: {
        valueService: {
          useClass: ValueService,
        },
      },
    });

    const app = ReactDIContext.create(AppModule);

    expect(app.scope.resolve<ValueService>("valueService").value).toBe(
      "useClass",
    );
  });

  it("rejects scoped provider lifetime", () => {
    class ValueService {
      declare private readonly __brand: never;
    }

    const AppModule = createModule({
      name: "AppModule",
      providers: {
        valueService: {
          useClass: ValueService,
          lifetime: Lifetime.SCOPED,
        },
      },
    } as any);

    expect(() => ReactDIContext.create(AppModule)).toThrow(
      ERRORS.ScopedProviderLifetimeError,
    );
  });

  it("rejects scoped module providerOptions lifetime", () => {
    class ValueService {
      declare private readonly __brand: never;
    }

    const AppModule = createModule({
      name: "AppModule",
      providerOptions: {
        lifetime: Lifetime.SCOPED,
      },
      providers: {
        valueService: ValueService,
      },
    } as any);

    expect(() => ReactDIContext.create(AppModule)).toThrow(
      ERRORS.ScopedProviderLifetimeError,
    );
  });

  it("rejects scoped context providerOptions lifetime", () => {
    const AppModule = createModule({
      name: "AppModule",
    });

    expect(() =>
      ReactDIContext.create(AppModule, {
        providerOptions: {
          lifetime: Lifetime.SCOPED,
        },
      } as any),
    ).toThrow(ERRORS.ScopedProviderLifetimeError);
  });
});

describe("createModule", () => {
  it("returns the original module when no hash input is provided", () => {
    const module = createModule({
      name: "PlainModule",
    });

    expect(createModule(module)).toBe(module);
  });

  it("adds a stable hash suffix when hash input is provided", () => {
    const ModuleA = createModule(
      {
        name: "DynamicModule",
      },
      {
        hashNameFrom: { b: 2, a: ["x", { c: null }] },
        hashLength: 6,
      },
    );
    const ModuleB = createModule(
      {
        name: "DynamicModule",
      },
      {
        hashNameFrom: { a: ["x", { c: null }], b: 2 },
        hashLength: 6,
      },
    );

    expect(ModuleA.name).toMatch(/^DynamicModule_[0-9a-f]{6}$/);
    expect(ModuleA.name).toBe(ModuleB.name);
  });

  it("uses the default hash length", () => {
    const module = createModule(
      {
        name: "DefaultHashModule",
      },
      {
        hashNameFrom: "tenant-a",
      },
    );

    expect(module.name).toMatch(/^DefaultHashModule_[0-9a-f]{8}$/);
  });
});
