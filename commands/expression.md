---
description: Generate custom Expression Functions and Renderers for use in Kibana Canvas, Lens, and Dashboard visualizations
---

# Generate Kibana Expression

Create custom Expression Functions and/or Renderers that integrate with Kibana's expression pipeline (Canvas, Lens, Dashboard). Ask the user for:

1. **Function or Renderer?** Are they creating an expression function, a renderer, or both?
2. **Function name** (snake_case, e.g. `my_metric_calc`)
3. **What it does** (description of the transformation or computation)
4. **Input type** — what data does it receive from the previous function in the pipeline? (`datatable`, `number`, `string`, `null`, `kibana_context`)
5. **Arguments** — named parameters with types and defaults
6. **Output type** — what data does it produce? (`datatable`, `number`, `string`, `render`, custom type)
7. **For renderers**: What does it visually display? (chart, metric, table, custom visualization)
8. **Server or browser?** Does the function need server-side access (ES queries) or is it browser-only?

## Generation Steps

1. Create the expression files:
   ```
   common/expressions/          # Functions that work on both server and browser
   ├── index.ts
   ├── my_function.ts           # Expression function definition
   └── types.ts                 # Custom expression types
   public/expression_renderers/ # Renderers (browser-only)
   ├── index.ts
   └── my_renderer.tsx          # Expression renderer
   ```

2. For an **Expression Function**:
   - Define the function using `ExpressionFunctionDefinition`
   - Specify `name`, `help`, `args`, `inputTypes`, `type` (output)
   - Implement `fn(input, args, context)` — the transformation logic
   - Register in `setup()` via `expressions.registerFunction(myFunction)`

3. For an **Expression Renderer**:
   - Define the renderer using `ExpressionRenderDefinition`
   - Specify `name`, `displayName`, `help`, `reuseDomNode`
   - Implement `render(domNode, config, handlers)` — mounts the visualization
   - Call `handlers.done()` when rendering is complete
   - Register in `setup()` via `expressions.registerRenderer(myRenderer)`

4. For **custom expression types**:
   - Define the type with `ExpressionTypeDefinition`
   - Specify `name`, `from` (conversion functions from other types), `to` (conversion to other types)
   - Register via `expressions.registerType(myType)`

5. Register everything:
   - Functions can be registered on both server and browser `setup()`
   - Renderers are browser-only — register in public `setup()`
   - Add `expressions` to `requiredPlugins` in `kibana.jsonc`

## Important Rules

- Expression functions must be pure and stateless — same input + args = same output
- Functions in `common/` can run on both server and browser; put them there for maximum flexibility
- Renderers are always browser-only (they render DOM)
- Always call `handlers.done()` in renderers — Canvas/Dashboard waits for this signal
- Use `handlers.onDestroy(() => { ... })` in renderers to clean up (unmount React, remove listeners)
- For renderers that use React: `ReactDOM.render()` in `render()`, `ReactDOM.unmountComponentAtNode()` in `onDestroy`
- Set `reuseDomNode: true` on renderers to avoid DOM node recreation on re-render (better performance)
- Expression functions should handle `null` input gracefully
- Use the `datatable` type for tabular data — it's the standard interchange format in expressions
- For server-side functions that query ES, use `context.search.search()` from the expression context
- Keep functions focused — one function = one transformation. Chain them in the pipeline.

## Datatable Type Reference

The `datatable` is the core data type in expressions:

```typescript
interface Datatable {
  type: 'datatable';
  columns: Array<{
    id: string;        // Column identifier
    name: string;      // Display name
    meta: {
      type: 'number' | 'string' | 'boolean' | 'date' | 'null';
      field?: string;
      params?: Record<string, unknown>;
    };
  }>;
  rows: Array<Record<string, unknown>>;
}
```

## Common Use Cases

**Custom aggregation function:** Takes a `datatable`, computes a metric, returns a `number` or modified `datatable`.

**Custom visualization renderer:** Takes a render config object, mounts a React/D3/Canvas chart.

**Data transformation:** Takes a `datatable`, filters/sorts/reshapes rows, returns a `datatable`.

**Kibana context function:** Takes `kibana_context` (timeRange, filters, query), fetches data, returns a `datatable`.
