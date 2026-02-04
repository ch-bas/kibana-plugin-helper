---
description: Generate a React component using Elastic UI (EUI) for a Kibana plugin's public side
---

# Generate EUI Component

Create a new React component using EUI for a Kibana plugin. Ask the user for:

1. **Component name** (PascalCase, e.g. `UserManagementTable`)
2. **Component type**: page, table, form, modal, flyout, panel, detail view, dashboard card
3. **What it displays / does** (brief description)
4. **Data source**: API endpoint it fetches from, or props it receives
5. **Interactive features**: search, pagination, sorting, filtering, CRUD actions

## Generation Rules

- Always use EUI components — never raw HTML elements for UI
- Use functional components with hooks
- Place in `public/components/` directory
- Use TypeScript with proper interface definitions for props and data types
- Include loading states (EuiLoadingSpinner or EuiProgress)
- Include empty states (EuiEmptyPrompt)
- Include error states with user-friendly messages
- Use `useKibana()` hook for accessing services (http, notifications)

## Component Type Templates

### Table Component
- Use `EuiInMemoryTable` for small datasets or `EuiBasicTable` with server-side pagination for large ones
- Include search box, column sorting, pagination
- Include row actions (edit, delete) with confirmation modals for destructive actions
- Show `EuiEmptyPrompt` when no items exist

### Form Component
- Use `EuiForm` with `EuiFormRow` for each field
- Include client-side validation with error messages
- Use appropriate EUI form controls (EuiFieldText, EuiSelect, EuiSwitch, EuiComboBox, etc.)
- Include submit/cancel buttons in an `EuiFlexGroup`
- Show loading state on submit button
- Use `EuiCallOut` for form-level errors

### Modal / Flyout Component
- Use `EuiModal` for simple confirmations or `EuiFlyout` for detail views / forms
- Always include proper close handling
- Include a footer with action buttons
- Handle escape key and overlay click to close

### Page Component
- Use `EuiPageHeader` with title, description, and right-side action buttons
- Use `EuiPageSection` for content areas
- Include breadcrumbs via `core.chrome.setBreadcrumbs()`
- Use `EuiSpacer` for consistent spacing

### Detail View
- Use `EuiDescriptionList` for key-value data display
- Include `EuiPanel` grouping for related information
- Add action buttons (edit, delete) in the header
- Include a back/breadcrumb navigation

## Always Include
- TypeScript interfaces for all data shapes
- Proper cleanup in useEffect hooks
- Accessible labels and aria attributes where needed
- Responsive design considerations (EUI handles most of this)
