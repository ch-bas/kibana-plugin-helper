---
description: Generate custom UI Actions and Triggers for inter-plugin communication in Kibana — register actions, attach to triggers, execute across plugins
---

# Generate Kibana UI Action

Create custom UI Actions and Triggers that enable inter-plugin communication and contextual user interactions (e.g. clicking a table row to open a flyout, drilldowns from dashboard panels, context menu items). Ask the user for:

1. **Action or Trigger?** Are they creating a new action, a new trigger, or both?
2. **Action ID** (UPPER_SNAKE_CASE, e.g. `MY_PLUGIN_OPEN_DETAIL_ACTION`)
3. **Action display name** (human-readable, e.g. "Open detail view")
4. **Trigger ID** (if creating a trigger — e.g. `MY_PLUGIN_ROW_CLICK_TRIGGER`)
5. **Context type** — what data does the action receive when executed? (e.g. a saved object ID, an embeddable, a row of data, coordinates)
6. **Where does it appear?** Context menu, panel header, custom trigger point, or programmatic execution
7. **What does it do?** Opens a flyout, navigates to a page, applies a filter, opens a modal, calls an API

## Generation Steps

1. Create the action/trigger files in `public/actions/` and/or `public/triggers/`:
   ```
   public/
   ├── actions/
   │   ├── index.ts
   │   ├── my_action.ts            # Action implementation
   │   └── my_action_context.ts    # Context type definition
   ├── triggers/
   │   ├── index.ts
   │   └── my_trigger.ts           # Trigger definition
   ```

2. For a **Trigger**:
   - Define a trigger ID constant
   - Create the trigger with `id`, `title`, `description`
   - Register via `uiActions.registerTrigger()` in `setup()`

3. For an **Action**:
   - Define an action ID constant
   - Create an action class extending `Action<Context>` or using `createAction()`
   - Implement `execute({ context })` — the logic that runs when triggered
   - Implement `isCompatible({ context })` — whether the action should appear for this context
   - Implement `getDisplayName()`, `getIconType()` for menu rendering
   - Register via `uiActions.registerAction()` in `setup()`
   - Attach to one or more triggers via `uiActions.attachAction(triggerId, actionId)` in `setup()`

4. For **built-in triggers** (attach actions to existing Kibana triggers):
   - `CONTEXT_MENU_TRIGGER` — right-click / "..." menu on dashboard panels
   - `PANEL_BADGE_TRIGGER` — badge icons on panel headers
   - `PANEL_NOTIFICATION_TRIGGER` — notification dots on panels
   - `SELECT_RANGE_TRIGGER` — brush selection on time-series charts
   - `VALUE_CLICK_TRIGGER` — clicking a value in a visualization
   - `ROW_CLICK_TRIGGER` — clicking a row in a data table
   - `APPLY_FILTER_TRIGGER` — applying a filter from a visualization

5. Register everything in the public plugin's `setup()`:
   ```typescript
   uiActions.registerTrigger(myTrigger);
   uiActions.registerAction(myAction);
   uiActions.attachAction(TRIGGER_ID, ACTION_ID);
   ```

## Important Rules

- Action IDs must be globally unique — prefix with your plugin ID
- Trigger IDs must be globally unique — prefix with your plugin ID for custom triggers
- Actions attached to `CONTEXT_MENU_TRIGGER` appear in the "..." menu of every dashboard panel — use `isCompatible()` to filter
- Always implement `isCompatible()` — returning `true` for every context clutters menus
- Use `getHref()` if your action navigates to a URL — this enables "open in new tab"
- Actions are registered in `setup()`, not `start()` — they must exist before dashboards render
- For async operations in `execute()`, show a toast or loading indicator so the user knows something is happening
- Context types should be as narrow as possible — don't pass the entire embeddable when you only need an ID
- Add `uiActions` to `requiredPlugins` in `kibana.jsonc`
- For drilldowns (user-configurable actions), use the Drilldowns plugin instead of raw UI Actions

## Common Patterns

**Context menu action on dashboard panels:**
Attach to `CONTEXT_MENU_TRIGGER`, check `isCompatible` for your embeddable type.

**Click-to-filter:**
Attach to `VALUE_CLICK_TRIGGER`, apply a filter via `data.query.filterManager.addFilters()`.

**Row click to flyout:**
Create a custom trigger, fire it from your table's `onRowClick`, action opens an `EuiFlyout`.

**Cross-plugin navigation:**
Action uses `core.application.navigateToApp()` to jump to another plugin with state.
