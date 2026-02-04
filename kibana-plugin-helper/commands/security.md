---
description: Set up authentication, authorization (RBAC), feature privileges, and security middleware for a Kibana plugin
---

# Set Up Kibana Plugin Security

Configure authentication and role-based access control for a Kibana plugin. Ask the user for:

1. **Plugin ID** (to register features)
2. **Access levels needed**: read-only, read-write, admin — or custom levels
3. **Features to protect**: which routes/UI elements need which privilege level
4. **Security model**: simple (all-or-nothing), tiered (read/write/admin), or custom per-feature
5. **Optional**: LDAP/SSO considerations, multi-tenancy requirements

## What to Generate

### 1. Feature Registration (in server plugin setup)
- Register the plugin as a Kibana feature with `features.registerKibanaFeature()`
- Define privilege tiers (all, read, and optionally custom sub-feature privileges)
- Map API tags to privilege levels (e.g. `my_plugin-read`, `my_plugin-write`, `my_plugin-admin`)
- Map UI capabilities for frontend privilege checks

### 2. Route-Level Authorization
- Add `security.authz.requiredPrivileges` to each route definition
- Group routes by required privilege level
- Ensure all routes have explicit authorization (no unprotected routes by default)

### 3. Frontend Privilege Checks
- Generate a `usePrivileges` hook that checks `application.capabilities`
- Show/hide UI elements based on user capabilities
- Disable actions the user doesn't have permission for (don't just hide — disable with tooltip)
- Redirect unauthorized users to an access-denied page

### 4. User Context Utilities
- Generate a server-side utility to extract current user from request context
- Generate a `useCurrentUser` hook for the public side
- Include user role checking helper functions

### 5. Multi-Tenancy (if requested)
- Generate tenant isolation middleware that extracts tenant ID from user metadata or custom header
- Add tenant_id filter to all Elasticsearch queries
- Ensure index operations scope to the correct tenant
- Add tenant context to logging

## Security Best Practices to Enforce
- Never expose `asInternalUser` through API routes to the client
- Always validate that the user has appropriate roles before performing actions
- Log security-relevant events (auth failures, privilege escalation attempts)
- Don't leak internal error details to the client — log them server-side, return generic messages
- Use HTTPS-only cookies for session data
- Sanitize user input to prevent injection in Elasticsearch queries
