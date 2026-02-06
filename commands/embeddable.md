---
description: Generate a custom Embeddable panel that can be placed on Kibana Dashboards, with factory registration, input/output types, and React rendering
---

# Generate Kibana Embeddable

Create a custom Embeddable that can be rendered inside Kibana Dashboards or other container contexts. Ask the user for:

1. **Embeddable type ID** (snake_case, e.g. `my_plugin_widget`)
2. **Display name** (human-readable, e.g. "My Plugin Widget")
3. **What it renders** (description of the visualization or content)
4. **Input parameters** (what data/config the embeddable accepts from the dashboard)
5. **Output parameters** (what data the embeddable exposes to the dashboard/container)
6. **Data source**: Does it query Elasticsearch directly, use a saved object, or receive all data via input?
7. **Interactive?** Does it emit events (e.g. filter clicks, drilldowns)?
8. **Needs saved object reference?** Can users save/load configurations for this embeddable?

## Generation Steps

1. Create the embeddable directory structure:
   ```
   public/embeddable/
   ├── index.ts
   ├── my_embeddable.tsx           # The embeddable class
   ├── my_embeddable_factory.ts    # Factory for creating instances
   ├── my_embeddable_component.tsx # React component rendered inside
   └── types.ts                    # Input/Output interfaces
   ```

2. Define Input and Output interfaces in `types.ts`:
   - Input extends `EmbeddableInput` — includes `id`, `title`, `timeRange`, `filters`, `query`, plus custom fields
   - Output extends `EmbeddableOutput` — includes any data the embeddable exposes to the container

3. Create the Embeddable class:
   - Extends `Embeddable<MyInput, MyOutput>`
   - Implements `render(node: HTMLElement)` and `reload()` methods
   - Renders a React component into the provided DOM node
   - Handles input changes via `this.getInput()` and `this.updateInput()`
   - Handles output updates via `this.updateOutput()`
   - Implements `destroy()` for cleanup (unmount React, cancel subscriptions)

4. Create the EmbeddableFactory:
   - Extends `EmbeddableFactoryDefinition`
   - Sets `type`, `displayName`, `grouping`, `getIconType()`
   - Implements `create(input, parent?)` to instantiate the embeddable
   - Optionally implements `getExplicitInput()` for a creation wizard/modal
   - Optionally implements `canCreateNew()` and `isEditable()`

5. Create the React rendering component:
   - Receives embeddable input as props or via `useEmbeddableInput()` pattern
   - Uses EUI components for consistent styling
   - Handles loading, error, and empty states
   - Subscribes to input changes for reactivity

6. Register the factory in the public plugin's `setup()`:
   ```typescript
   plugins.embeddable.registerEmbeddableFactory(myEmbeddableFactory);
   ```

7. If the embeddable needs a saved object:
   - Create a saved object type (use /saved-object command)
   - Implement `savedObjectMetaData` on the factory for Dashboard's "Add panel" flow
   - Implement `createFromSavedObject()` on the factory

## Important Rules

- Always extend `EmbeddableInput` / `EmbeddableOutput` — never define standalone
- Always implement `destroy()` to prevent memory leaks (unmount React, unsubscribe observables)
- Always handle `timeRange`, `filters`, and `query` from input if the embeddable shows time-based data
- Use `this.input$` observable (or `getInput$()`) to react to dashboard-level changes (time picker, filters)
- For React rendering, use `ReactDOM.render()` in the `render()` method and `ReactDOM.unmountComponentAtNode()` in `destroy()`
- Set `isContainer: false` unless your embeddable hosts other embeddables
- Use `EmbeddablePanel` wrapper for consistent chrome (title, actions, loading indicator)
- Register the factory during `setup()`, not `start()` — factories must be available before dashboards load
- For the "Add panel" flow, implement `getExplicitInput()` which returns a Promise of the initial input (can show a modal)
- Use `embeddable.getInput$().pipe(distinctUntilChanged())` to avoid unnecessary re-renders

## React Embeddable Pattern (Kibana 8.8+)

For newer Kibana versions, prefer the React Embeddable pattern using `ReactEmbeddableFactory`:

```typescript
import { ReactEmbeddableFactory } from '@kbn/embeddable-plugin/public';

export const myReactEmbeddableFactory: ReactEmbeddableFactory<MyState> = {
  type: MY_EMBEDDABLE_TYPE,
  deserializeState: (state) => state.rawState,
  buildEmbeddable: async (state, buildApi) => {
    const api = buildApi(
      {
        serializeState: () => ({ rawState: state }),
      },
      { /* comparators for state diffing */ }
    );
    return {
      api,
      Component: () => <MyEmbeddableComponent state={state} />,
    };
  },
};
```

Use the classic pattern for Kibana < 8.8 and the React pattern for 8.8+. Ask the user which Kibana version they target.
