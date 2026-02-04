---
description: Generate tests for Kibana plugin server routes (Jest) and React components (React Testing Library)
---

# Generate Kibana Plugin Tests

Generate comprehensive tests for existing Kibana plugin code. Ask the user for:

1. **What to test**: a server route file, a React component, a service/utility, or a hook
2. **File path** of the code to test
3. **Test coverage goals**: happy path only, or full coverage including error cases

## Generation Rules

### Server Route Tests
- Use Kibana's built-in mocks: `httpServerMock`, `httpServiceMock`, `loggingSystemMock` from `@kbn/core/server/mocks`
- Mock the Elasticsearch client methods (`get`, `search`, `index`, `update`, `delete`, `bulk`)
- Test that routes are registered with correct paths and methods
- Test handler responses for success cases
- Test handler responses for error cases (ES errors, validation errors, not found)
- Test validation schemas reject invalid input
- Create a mock context factory that returns properly structured core context with ES client mocks
- Use `httpServerMock.createKibanaRequest()` for request objects
- Use `httpServerMock.createResponseFactory()` for response assertions

### React Component Tests (React Testing Library)
- Use `@testing-library/react` with `render`, `screen`, `waitFor`, `fireEvent`, `within`
- Mock `@kbn/kibana-react-plugin/public` useKibana hook with mock services (http, notifications)
- Test loading state renders correctly
- Test successful data rendering after async load
- Test empty state when no data
- Test error state and toast notifications on failure
- Test user interactions (click, form submit, search, pagination)
- Test modal/flyout open and close behavior
- Use `waitFor` for async state updates
- Never use Enzyme — always use React Testing Library

### Custom Hook Tests
- Use `@testing-library/react-hooks` or `renderHook` from `@testing-library/react`
- Test initial state
- Test state after async operations resolve
- Test error handling
- Test refetch / refresh behavior

### Service / Utility Tests
- Pure unit tests with Jest
- Test all code paths including edge cases
- Mock HTTP client for API service classes
- Test error transformation and handling

## Test File Placement
- Colocate tests next to source files as `*.test.ts` / `*.test.tsx`
- Or place in `__tests__/` directory mirroring the source structure
- Follow the project's existing convention

## Template Structure
```
describe('ComponentOrRoute', () => {
  // Setup: mocks, beforeEach, afterEach
  // Test group: 'renders correctly'
  // Test group: 'handles user interactions'
  // Test group: 'handles errors'
  // Test group: 'edge cases'
});
```
