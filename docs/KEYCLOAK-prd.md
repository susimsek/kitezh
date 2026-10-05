# Kitezh Administration Console PRD (Keycloak parity)

## Purpose

This product requirements document defines the administration-console information architecture that this application should follow when it presents Keycloak-like realm administration capabilities. It translates Keycloak's documented console structure, event-auditing model, REST surface, and administrative role model into a screen-level plan for this application.

The target is a single-issuer Kitezh application. The application should adopt the parts of Keycloak's navigation and interaction model that make administration predictable, while keeping its own resource names, API contracts, role constants, and existing visual system. A Keycloak installation can manage several isolated realms; this application currently exposes one configured issuer and does not expose a realm selector. That difference is intentional and is recorded as a scope boundary below.

## Executive findings

1. Keycloak separates **configuration** from **history**. Realm Settings is the home for realm-wide configuration, while Events is the home for stored event records and filters.[^1]
2. Event auditing has two distinct streams: user events and administrative events. Their settings, stored representations, filters, and clear actions are separate in the Keycloak console.[^2]
3. Event settings belong under the Settings navigation in this project. The event history belongs at `/admin/events`, and the configuration belongs at `/admin/settings/events`.
4. Keycloak uses `view-events` and `manage-events` as separate administrative permissions. Read access must not imply the ability to change configuration or delete history.[^1]
5. The save action should follow the existing Settings pattern: a single vertical form inside the shared settings card, with a primary Save button in the bottom action row, an inline progress spinner, and localized success or error feedback.
6. The current application already has an administrative event stream, filtering, retention settings, clear-history behavior, and the `EVENT_VIEWER`/`EVENT_MANAGER`/`ADMIN` authorization split. The remaining Keycloak parity gaps are primarily the separate user-event stream, event-type selection, listener configuration, and representation-level event details.

## Product scope

### In scope

- A stable admin-console information architecture for users, groups, clients, client scopes, sessions, settings, and events.
- A settings destination that contains realm-wide application controls and an Events settings section.
- A read-only event-history screen with filtering, pagination, event details, and a permission-gated clear action.
- Event recording, administrative-event detail capture, retention, and event listener extension points.
- Explicit view/manage authorization for every administrative area.
- Screen states for loading, empty results, validation, save success, save failure, forbidden access, and destructive-action confirmation.
- API and persistence requirements that allow the UI to remain consistent with the existing Spring, JPA, Liquibase, and cache conventions.

### Out of scope for the current application

- A multi-realm selector or master-realm administration. Keycloak treats realms as isolated management spaces and allows a master realm to administer other realms; this application has one configured issuer instead.[^1]
- Keycloak's full fine-grained permission-management UI, Organizations, identity-provider administration, authorization services, and server-level metrics.
- A requirement to reproduce Keycloak's exact CSS, wording, or internal REST paths.
- Replacing the application's existing role names with Keycloak client-role names.

## Keycloak information architecture

### Global shell

The Keycloak Admin Console is scoped to a current realm. The shell exposes the current realm selector, a top-right account/logout menu, and the navigation for the selected realm. The documented first-use flow asks the administrator to select or create a realm and then open **Realm settings** for that realm.[^1]

The equivalent shell in this application is:

| Keycloak concept | Application placement | Requirement |
| --- | --- | --- |
| Current realm selector | Not present | Keep one configured issuer; do not present a misleading realm switcher. |
| Realm administration navigation | Admin sidebar | Keep resource links grouped by resource type and permission. |
| Account/logout menu | Existing admin shell | Preserve the current account and logout behavior. |
| Realm Settings | **Settings** | Use Settings as the home for server and realm-wide configuration. |
| Events history | **Events** | Keep history separate from configuration. |

The sidebar must hide a resource when the user cannot query or view it, and the API remains authoritative even when a navigation item is hidden. A direct URL must produce the same authorization result as a sidebar click.

### Primary navigation model

The following model is the recommended subset of Keycloak's realm administration layout:

| Area | Keycloak responsibility | Application screen | Access intent |
| --- | --- | --- | --- |
| Dashboard | Realm overview and operational entry point | Existing admin landing page | Authenticated admin |
| Users | Search, create, inspect, edit, disable, and manage membership | `/admin/users` and user detail screens | `ROLE_USER_VIEWER` or `ROLE_USER_MANAGER` |
| Groups | Search, create, inspect, and manage membership/role mappings | `/admin/groups` and group detail screens | `ROLE_USER_VIEWER` or `ROLE_USER_MANAGER` |
| Clients | Register and manage OAuth/OIDC clients | `/admin/clients` and client detail screens | `ROLE_CLIENT_VIEWER` or `ROLE_CLIENT_MANAGER` |
| Client scopes | Reusable scopes and protocol claims | Existing client-scope screens | Admin capability where implemented |
| Sessions | Active browser/session visibility and invalidation | Existing session screens | Admin capability where implemented |
| Events | Stored event history and filters | `/admin/events` | `ROLE_EVENT_VIEWER`/`ROLE_EVENT_MANAGER` equivalent |
| Authentication | Authentication flows, required actions, and authentication policies | `/admin/authentication/*` | Admin |
| Settings | Realm-wide general, login, session, email, profile, localization, and event configuration | `/admin/settings/*` | Admin, plus event-specific access for Events settings |

Keycloak also has areas such as Identity Providers, Organizations, Authorization, and realm-management roles. They should remain explicit roadmap items until the corresponding server behavior, API, persistence, and access tests exist; a navigation placeholder must not imply that the feature is available.

### Resource detail layout

Keycloak uses resource-specific detail views with tabs or sections for related concerns. The project should retain that pattern:

- **User detail**: profile, credentials/required actions, group membership, role mappings, sessions, consents, and events where implemented.
- **Group detail**: group profile, child groups, members, and role mappings.
- **Client detail**: general settings, capabilities, login settings, credentials, scopes, sessions, consents, and events.
- **Authentication**: the home for authentication policies, with password, OTP, and WebAuthn policy tabs.
- **Settings**: a stable tab strip for general, login, email, brute-force, sessions, events, user profile, and localization.

Tabs must not be used as a substitute for authorization. A tab that is not available to the current authority should be omitted, and a direct request for its API must return the centralized forbidden response.

## Events information architecture

### Why configuration and history are separate

Keycloak's event documentation presents configuration under **Realm settings → Events**, while stored records are opened from the top-level **Events** menu. This separation lets a read-only auditor inspect history without granting configuration or deletion rights.[^2]

The application follows the same model:

```text
Authentication
└── Policies
    ├── Password policy
    ├── OTP policy
    └── WebAuthn policy

Settings
└── Events
    ├── Event recording
    ├── Administrative event details
    └── Retention

Events
├── Search and filters
├── Event table
├── Event detail
└── Clear all events (manager only)
```

### Event Settings screen

Route: `/admin/settings/events`

The screen must use the same `AdminPageHeader`, settings navigation, shared `admin-panel-card`, vertical form spacing, and `admin-form-actions` row as the other Settings screens. The form contains:

| Control | Behavior | Keycloak relationship |
| --- | --- | --- |
| Enable event recording | Enables or disables persistence of supported events | Corresponds to saving events in the User events/Admin events settings. |
| Enable administrative events | Enables the administrative audit stream | Corresponds to Keycloak's Admin events **Save events** switch. |
| Include event details | Stores request/representation details when supported | Corresponds to **Include representation** for admin events. Keycloak warns that this can increase stored data.[^2] |
| Retention (days) | `0` means no expiry; positive values purge older records | Maps the product's day-based setting to its persistence policy. Keycloak's provider representation calls this `eventsExpiration` and expresses it as provider configuration.[^3] |

Interaction requirements:

- Load the current values before enabling Save.
- Keep controls in one vertical column; do not introduce a side-by-side form or a floating action area.
- Place the primary Save button at the bottom of the card in the existing action row. Preserve the button label while showing an inline spinner and disable repeated submission.
- Reset the form to the server response after a successful save.
- Show a localized success alert after save and a localized error alert after load or save failure.
- A user with event view access can inspect the form but cannot edit controls or submit it.
- A user without event view access receives the normal forbidden behavior and does not get a partially rendered settings page.
- Validation must reject non-integer and out-of-range retention values at the form boundary and again at the API boundary.

### Events history screen

Route: `/admin/events`

The history screen contains:

1. A page header with the total record count.
2. A Search/filter control that can narrow by action, target type, target identifier, and date range.
3. A stable, paginated table sorted by newest event first.
4. An event detail view that exposes actor, action, target, timestamp, and stored details when available.
5. A manager-only **Clear all events** action placed in the existing action row, using a destructive confirmation dialog.

The page must distinguish an empty result from a failed request. Clearing history must close the confirmation dialog only after a successful response, refresh the table, and show a localized success message. It must not silently clear records on a GET or on navigation.

Keycloak's Admin REST API supports event-history filtering by client, user, IP address, date range, event type, offset, maximum result count, and sort direction. Its administrative-event API additionally supports operation type, authenticated realm/client/user/IP, resource path/type, date range, offset, maximum result count, and direction.[^3][^4] The application can expose its existing resource-oriented filters without copying every Keycloak parameter; each supported filter must have a documented DTO and an indexed query path.

### Two event streams

Keycloak documents both streams explicitly:

- **User events** cover actions affecting users, such as successful or failed login and account changes. They have saved event types, expiration, and a clear-user-events operation.[^2]
- **Admin events** cover administrator actions performed through the Admin Console or Admin REST API. They can optionally include the JSON representation sent to the API, and they have a clear-admin-events operation.[^2]

The current application stores an administrative audit stream. The product should preserve that behavior and model user events as a separate capability if user-event parity is required. A single mixed table may be used internally only when the event type is explicit and the UI/API preserve the two-stream semantics.

### Event listeners

Keycloak exposes event listeners under **Realm settings → Events → Event listeners**. Built-in listeners can write to logs or send email, and the listener SPI allows extensions to react to events.[^2] The application should reserve a settings section for listener registration and delivery policy, but should not expose a listener toggle until the server has a durable listener registry, delivery error handling, audit events, and integration tests.

## Authorization model

### Keycloak reference roles

Keycloak's documented realm-management roles include `manage-events` and `view-events`, alongside `manage-users`, `query-users`, `query-groups`, `query-clients`, `manage-clients`, `view-users`, `view-clients`, `manage-realm`, `view-realm`, and other resource-specific roles.[^1] Query permissions allow the console to find resources; view permissions allow resource details; manage permissions allow mutation. The exact availability of a menu therefore depends on the combination of query, view, and manage roles.

### Application roles

The application uses stable application authorities rather than exposing Keycloak client-role names directly:

| Application authority | Capability | Event Settings | Events history | Clear history |
| --- | --- | --- | --- | --- |
| `ROLE_ADMIN` | Full administration | Read/write | Read | Yes |
| `ROLE_EVENT_VIEWER` | Inspect event configuration and history | Read-only | Read | No |
| `ROLE_EVENT_MANAGER` | Manage event settings and history | Read/write | Read | Yes |
| `ROLE_USER_VIEWER` | Inspect users and groups where implemented | No | No | No |
| `ROLE_USER_MANAGER` | Manage users, groups, and memberships where implemented | No | No | No |
| `ROLE_CLIENT_VIEWER` | Inspect clients where implemented | No | No | No |
| `ROLE_CLIENT_MANAGER` | Manage clients where implemented | No | No | No |

The role-to-screen mapping must be defined once in the authority constants and reused by backend security rules, service checks, UI access flags, and tests. `ROLE_EVENT_VIEWER` is the application counterpart of Keycloak's `view-events`; `ROLE_EVENT_MANAGER` is the counterpart of `manage-events`. If the product keeps the existing `EVENT_VIEWER` and `EVENT_MANAGER` constants internally, the API and documentation should still expose one consistent naming convention to clients.

### Authorization acceptance rules

- A viewer can load settings and history but cannot update settings or delete records.
- A manager can update settings and clear records.
- An administrator inherits manager behavior.
- Every mutation checks the authority on the server and records an audit event.
- Mutations that change effective permissions, settings, sessions, or authorization state invalidate affected sessions and OAuth2 authorizations according to the application security policy.
- Hiding a button is a usability feature only; it is not the authorization boundary.

## Current feature parity with Keycloak

The following matrix compares the behavior currently implemented in this repository with the corresponding Keycloak capability. “Implemented” means the application exposes a working, tested product behavior. “Partial” means a related behavior exists but the scope, data model, token contract, or administration model differs. “Missing” means there is no product behavior yet. A missing feature remains a roadmap item and must not be implied by a navigation link.

| Capability | Current application | Keycloak reference behavior | Parity | Product implication |
| --- | --- | --- | --- | --- |
| Realm boundary | One configured issuer and one shared data space | Isolated realms contain users, clients, groups, roles, sessions, and realm settings; a master realm can administer other realms[^1] | Missing | Add realm/tenant IDs before claiming multi-tenant support. |
| Realm settings | Login, password, OTP, brute-force, email, session, and event settings | Realm Settings is the central configuration area with separate tabs | Partial | Keep the Settings route and add realm ownership when multi-tenancy is approved. |
| User CRUD | Admin API and UI | User list/detail, credentials, required actions, groups, roles, sessions, and consents | Partial | Credential inventory, individual lifecycle operations, and current-page bulk enable/disable/delete operations are covered; cross-page selection and bulk credential/required-action workflows remain. |
| Dynamic user profile | Application-wide configurable attributes with validation, requiredness, type checks, pattern/length rules, and optional multi-value support; managed under Settings and rendered in admin/account profile forms | Configurable user-profile attributes with validation and requiredness | Implemented for the single-issuer application | Keep the schema application-wide while realms are intentionally out of scope; add localized labels, token mappers, and per-realm ownership only if realm support is introduced. |
| Password and account recovery | Password policy, history, expiry, email verification, single-use reset tokens, configurable re-authentication age for email changes, administrator-managed reset-token lifetime/resend cooldown, and none/if-configured/required OTP reset policy | Password credentials and required actions are configured per realm; the reset-credentials authentication flow can be composed from executions such as reset-password and OTP, with realm-level required-action and token behavior[^8] | Partial | Add a durable admin-managed reset-credential execution flow and broader integration coverage before claiming full Keycloak parity. |
| TOTP and recovery codes | TOTP enrollment/verification, required TOTP, hashed recovery codes, WebAuthn/passkey enrollment and credential verification, and required passkeys | OTP/WebAuthn credentials and configurable required actions | Partial | TOTP and primary passkey sign-in are implemented, including OTP fallback, account/admin credential inventory, device metadata, label management, deletion, and both standard and passwordless required actions, plus configurable WebAuthn mediation and ceremony policy. Broader Keycloak authentication-flow composition remains outside this application. |
| User impersonation | Admin-only or dedicated impersonation authority, single-use ticket flow, console action, and actor/target audit details | Admin impersonation permission and console action | Implemented / Partial | The Keycloak-equivalent dedicated impersonation authority and audit context are implemented. Resource-specific user scopes remain part of the future fine-grained permission model. |
| Groups | CRUD, membership, hierarchy, parent role inheritance, multi-valued attributes, default groups, configurable group claims, and group-scoped permissions | Hierarchical groups, attributes, role mappings, default groups, membership permissions[^6] | Implemented / Partial | Preserve the single-issuer boundary; add broader Keycloak protocol mapper types and realm boundaries later. |
| Group claims | Configurable group membership mapper on client scopes with claim name and full-path options | Group membership mapper is configurable per client/client scope | Implemented / Partial | Add the remaining protocol mapper types and token-preview tooling. |
| Realm roles | Global application authorities with direct, group, and composite assignment | Realm-level roles with direct, group, and composite assignment | Implemented / Partial | Realm ownership and multi-tenant boundaries remain future work. |
| Client roles | Client-owned roles with direct/group mappings, composite relationships, client-role administration, and `roles`-scope filtered `resource_access` claims | Client roles are scoped to a client and appear in `resource_access` | Implemented / Partial | Realm ownership and finer-grained scope policies remain future work. |
| Composite roles | Single-issuer global and client role graphs, including cross-scope/cross-client composites, cycle protection, effective-role resolution, and standard role claims | Roles can include other roles with cycle protection | Implemented / Partial | Multi-realm ownership, client-scope role filtering, and fine-grained composite-management permissions remain separate increments. |
| Query permissions | `ROLE_USER_QUERY`, `ROLE_GROUP_QUERY`, and `ROLE_CLIENT_QUERY` authorize collection discovery and console navigation; viewer roles authorize collection/detail reads and manager roles authorize mutation. | `query-users`, `query-groups`, and `query-clients` control console discovery; the corresponding view roles also permit reads | Implemented / Partial | Query/list/detail separation is compatible with Keycloak. Differences are application-specific authority names, viewer roles covering collection access, more limited filtering, client-scope mapping, and broader query responses. Fine-grained permissions and realm differences are outside this item. |
| Event permissions | Event viewer/manager authorities protect event APIs | `view-events` and `manage-events` are separate realm-management roles[^1] | Implemented / Partial | Preserve the split; add user-event/provider scope later. |
| Client CRUD | Registered OAuth/OIDC clients, redirect URIs, secrets, grants, scopes | Clients have settings, credentials, client scopes, roles, sessions, and service accounts | Implemented / Partial | Core CRUD, client roles, service accounts, secret rotation/TTL, allow-listed client mappers, and scope evaluation are implemented. Broader credential policies and token issuance preview remain. |
| Client scopes | Scope CRUD and client assignment | Default/optional scopes with protocol mappers and role scope mappings | Implemented / Partial | Default/optional assignment, reusable scope-owned OIDC mappers, application/client role mappings, token filtering, scope evaluation, Keycloak-style consent/token-scope metadata, and protected built-in scopes are implemented for the single issuer; broader mapper types, SAML support, and full token preview remain. |
| Protocol mappers | Allow-listed client and reusable client-scope mapper entities for user properties, user attributes, groups, application/client roles, hardcoded claims, and audiences | Mappers turn user, group, role, and client data into OIDC/SAML claims[^11] | Implemented / Partial | Keycloak-style OIDC mappers are implemented for the single issuer: client and reusable client-scope ownership, priority ordering, user/group/application-role claims, client-role claims, hardcoded claims, audience and audience-resolve, target-token switches, CRUD, and static evaluation. SAML, realm isolation, and a full signed-token preview remain outside this application scope. |
| Authorization Code + PKCE | Browser clients use Authorization Code + S256 PKCE | Supported and standard for browser applications | Implemented | Keep as the default console flow. |
| Refresh tokens | Online refresh-token rotation, persistence, browser namespacing, logout handling, and `offline_access` sessions with configurable idle and absolute lifetime | Refresh/offline token policies with realm/client controls | Implemented / Partial | The single-issuer application supports explicit offline scope requests, browser-session detachment, refresh-token rotation, global idle/absolute policy, per-client lifetime overrides, account/admin session listing, individual revoke, and global revoke. Realm-scoped policy separation and full client/user not-before policy remain outside the no-realm model. |
| Client credentials | Seeded clients, client-credentials tokens, client-linked service-account users, application/client role mappings, and active-token revocation | Service accounts and client credentials | Implemented / Partial | Single-issuer service-account and role-mapping parity is implemented; realm-scoped policies and broader credential settings remain outside this no-realm application. |
| PAR, Device Authorization, introspection, revocation | Implemented and tested | Supported protocol endpoints | Implemented | Preserve endpoint metadata and integration tests. |
| OIDC discovery, UserInfo, JWKS, logout | Implemented | Standard OIDC provider endpoints and session/logout behavior | Implemented | Keep issuer and metadata stable for clients. |
| Token exchange | RFC 8693 token exchange is available to enabled confidential clients that explicitly include the token-exchange grant. The exchange validates the subject token, requester audience, target audience, optional down-scoped permissions, and optional actor delegation; direct `requested_subject` impersonation is rejected. Policies are configured per client because this sample has no realm layer. | Keycloak supports standard token exchange and administrator-controlled exchange permissions[^12] | Implemented (no realm-scoped policy or direct impersonation) | Keep the standard exchange boundary; add broader delegation only with an explicit application-level policy model. |
| CIBA | Backchannel authentication is implemented for confidential clients: the server creates an `auth_req_id`, persists the pending request, exposes approval/denial endpoints for the target user, and delivers the result through the client-registered poll, ping, or push mode | Keycloak supports CIBA with a configured backchannel authentication channel, policy, approval UX, and poll/push delivery modes | Partial | The implementation covers `authorization_pending`, `slow_down`, `access_denied`, `expired_token`, client grant opt-in, discovery metadata, client-level delivery mode and notification endpoint/token settings, ping notifications, push token responses, OIDC `id_token` responses, optional `offline_access` refresh tokens, `auth_req_id` binding in the authorization record and token claims, generated or client-supplied `user_code` values, the `login_hint`, `login_hint_token`, and `id_token_hint` request forms, signed `request` JWTs with audience and client algorithm-policy validation, an Admin → Settings → CIBA policy screen for request lifespan, polling interval, delivery-mode allowlisting, user verification, MFA, and step-up requirements, and an Account Console approval panel for reviewing pending requests and approving or denying them. |
| DPoP | DPoP proofs are accepted at all token/resource grant paths, DPoP-bound access tokens carry a `cnf.jkt` confirmation claim, clients can require proofs, authorization-code and PAR clients can require and validate `dpop_jkt`, refresh-token requests can require DPoP, public clients retain the same `cnf.jkt` key for refresh validation, protected-resource metadata advertises supported proof algorithms, each client can allow only selected asymmetric proof algorithms (currently RS256 and/or ES256), and resource APIs can enforce short-lived single-use nonce challenges | Keycloak supports DPoP-bound tokens, client-level requirement for DPoP proofs, refresh-token-only and strict `dpop_jkt` client policies, nonce challenge handling, and asymmetric proof algorithm policy | Implemented | Keep the client policy controls aligned with RFC 9449 and preserve the public-client same-key refresh check. |
| Resource indicators | The OAuth `resource` parameter is not interpreted | Current Keycloak documentation states that the server does not currently process OAuth 2.0 resource indicators[^13] | Not a current parity gap | Keep resource indicators out of the parity claim; evaluate RFC 8707 support only when the upstream server and product need are established. |
| SAML | No SAML IdP/SP | SAML client and identity-provider support | Missing | Separate protocol product decision. |
| Authentication flows | Fixed Spring Security flow with custom MFA filter and required actions | Configurable browser, registration, reset-credential, first-broker-login, and conditional flows[^8] | Partial | Introduce a flow graph only when administrators need reordering/conditions. |
| WebAuthn/passkeys | Spring Security WebAuthn registration/authentication ceremonies, account/admin credential inventory, labels, deletion, and required-action enrollment | WebAuthn credential and passkey authenticators | Partial | Registration, persistence, primary-factor sign-in, OTP step-up, account/admin inventory with signature and verification metadata, label management, deletion, configurable mediation, conditional sign-in, automatic passkey autofill, and standard/passwordless required actions are implemented. Broader Keycloak authentication-flow composition remains outside this application. |
| WebAuthn policy and mediation | Admin policy screen with `conditional`, `optional`, and `none` mediation, relying-party and authenticator policy, AAGUID allowlist, and separate passwordless policy | Configurable WebAuthn policy and browser mediation behavior for passkeys | Implemented / Partial | Authentication > Policies > WebAuthn persists both registration and passwordless policies. RP name/ID, signature algorithms, attestation, authenticator attachment, resident key, user verification, timeout, duplicate-authenticator protection, acceptable AAGUIDs, and mediation are validated and applied to Spring WebAuthn creation/request options. `conditional` starts conditional WebAuthn autofill when the browser supports it; authentication-flow composition remains outside this application. |
| Identity brokering | Google, GitHub, LinkedIn, Microsoft, and dynamic OIDC providers; provider-subject identities; safe first-broker account linking; account-console link management; admin-managed credentials; provider sync modes and mapper overrides | OIDC/SAML/social providers, mappers, account linking | Partial | The OAuth2/OIDC subset, provider CRUD, profile mappers, and `LEGACY`/`IMPORT`/`READ_ONLY`/`FORCE` synchronization policies are implemented. SAML, LDAP/AD, broader provider mapper types, additional provider families, and realm-scoped broker configuration remain roadmap work. |
| LDAP/Active Directory federation | Not implemented | Federated user stores with sync and mapper policies[^9] | Missing | Requires provider lifecycle, sync jobs, and failure handling. |
| Sessions | JPA browser and offline sessions, admin/account views, individual and global revoke, global idle/absolute policy, and client lifetime overrides | Online and offline sessions, client sessions, revocation and not-before policies | Implemented / Partial | The single-issuer application implements offline `offline_access` sessions, refresh-token rotation, account/admin revoke flows, a global offline-session policy, and per-client lifetime overrides. Realm-scoped ownership and full client/user not-before policy remain outside the no-realm model. |
| Consent | OAuth authorization and consent persistence/revoke | User consents and client-specific consent management | Implemented / Partial | Preserve current screens; add client-scope and realm boundaries later. |
| Admin events | Stored audit stream, filters, retention, clear action | Admin event history, filters, representation capture, event provider settings[^2][^3] | Partial | Current event settings parity is in place; add representation redaction/limits. |
| User events | No separate persisted user-event history | User event settings, saved event types, expiration, clear action[^2] | Missing | Add separate event type/storage and a User events tab. |
| Event listeners | No listener registry or provider SPI | Event listeners configured under Realm Settings → Events[^2] | Missing | Add only with delivery status, retries, and auditability. |
| Fine-grained admin permissions | Global role checks and endpoint rules | Resource/scope permissions for users, groups, clients, roles, organizations, and events | Partial | Add resource-scoped permission records and a policy evaluator. |
| Organizations | No organization model | Organization members, domains, invitations, IdPs, groups, and claims[^10] | Missing | Keep out of the single-issuer demo until B2B requirements exist. |
| Authorization Services / UMA | Spring Security authorities protect endpoints | Resources, scopes, policies, permissions, permission tickets, and RPTs[^7] | Missing | Separate resource-server authorization product from admin RBAC. |
| Admin REST | Documented custom `/api/admin` contract with OpenAPI | Keycloak Admin REST under `/admin/realms/{realm}` | Partial | Keep the application contract; map semantics explicitly rather than copying paths. |
| Account Console | Custom account pages for profile, security, sessions, consents, and configurable profile attributes | Keycloak Account Console and account REST capabilities | Partial | Preserve the current user experience and add credential inventory and device views. |
| Themes and localization | Next.js theme switcher, English/Turkish dictionaries, application-wide locale settings, persisted per-user locale preference, separate `login`/`account`/`admin`/`email`/`backend`/`common` bundles, database message overrides, and an effective-message browser | Themes, message bundles, supported locales, default locale, user locale preference, realm overrides, and effective bundle search | Implemented (application scope) | Built-in messages remain bundled resources; administrators can enable supported locales, choose one of the six message bundles, override individual messages, and inspect the merged frontend or backend bundle without a realm. The authenticated user's language preference is available as a separate field in the account profile and is persisted on the user record. Locale resolution follows the Keycloak order: an explicitly selected locale cookie, the authenticated user's profile preference, OIDC `ui_locales`, the browser cookie, the `Accept-Language` header, and the configured default. |

### Existing roles and Keycloak equivalents

The application's role constants are intentionally application-facing. They should not be renamed to Keycloak's internal `realm-management` client roles, but their scope must be documented and eventually mapped to resource-scoped permissions.

| Application authority | Current scope | Closest Keycloak concept | Difference to resolve |
| --- | --- | --- | --- |
| `ROLE_ADMIN` | Full application administration | `admin` or `realm-admin` | Current role is global and single-issuer. |
| `ROLE_USER_VIEWER` | Read user resources, including collection and detail reads | `view-users` | Application-facing authority; collection and detail reads are global unless an endpoint has an additional resource check. |
| `ROLE_USER_QUERY` | Discover and search user resources | `query-users` | Application-scoped discovery only; no realm boundary. |
| `ROLE_USER_MANAGER` | Mutate users and related membership | `manage-users` | Lacks fine-grained group/member and role-mapping scopes. |
| `ROLE_USER_IMPERSONATOR` | Impersonate eligible non-administrator users | `impersonation` | Current scope is single-issuer and global; resource-specific user scopes remain future work. |
| `ROLE_GROUP_VIEWER` | Read group resources and scoped permissions | `view-users`/fine-grained group scopes | Group operations remain application-scoped and may be narrowed by existing group permissions. |
| `ROLE_GROUP_QUERY` | Discover and search group resources | `query-groups` | Application-scoped discovery only; no realm boundary. |
| `ROLE_GROUP_MANAGER` | Mutate group resources and memberships | Fine-grained group scopes | Keycloak does not expose a standalone `manage-groups` role in the referenced role list. |
| `ROLE_CLIENT_VIEWER` | Read client and client-scope resources | `view-clients` | Client-scope discovery uses the same application mapping; resource boundaries remain application-scoped. |
| `ROLE_CLIENT_QUERY` | Discover and search client resources | `query-clients` | Application-scoped discovery only; no realm boundary. |
| `ROLE_CLIENT_MANAGER` | Mutate clients | `manage-clients` | Does not include service-account, mapper, or client-role policy. |
| `ROLE_EVENT_VIEWER` | Read event settings/history | `view-events` | Current stream is administrative only. |
| `ROLE_EVENT_MANAGER` | Update event settings and clear history | `manage-events` | Does not yet manage listener providers or user-event configuration. |

`query-users`, `query-groups`, and `query-clients` are discovery permissions in Keycloak; they are not substitutes for viewing or managing the returned resource. The application mirrors that distinction with `ROLE_USER_QUERY`, `ROLE_GROUP_QUERY`, and `ROLE_CLIENT_QUERY`. Query authorities allow collection discovery and navigation, viewer authorities allow collection and detail reads, and manager authorities allow discovery, reads, and mutation. The application currently returns a broader query representation than Keycloak's discovery-only permission model; this is a documented parity difference rather than a realm or fine-grained permission feature. These checks apply to the single configured issuer and shared data space; no realm or tenant ownership is introduced. Keycloak does not define a standalone `manage-groups` realm-management role in the current role list; group operations are represented through user/group permissions and fine-grained scopes.[^1][^6]

## Screen-by-screen layout specification

The visual system remains the existing React-Bootstrap admin console. Keycloak is used as an information-architecture reference, not as a reason to introduce a second component library or a second page grammar.

### Shared shell

Every authenticated administration screen uses the same structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ Admin Console | language | theme | signed-in user | sign out │
├───────────────┬─────────────────────────────────────────────┤
│ Dashboard     │ Page header: title, description, status      │
│ Clients       │                                                │
│ Client scopes │ Optional detail/settings tab row               │
│ Users         │                                                │
│ Roles         │ Main content: cards, tables, forms             │
│ Groups        │                                                │
│ Sessions      │                                                │
│ Consents      │                                                │
│ Keys          │                                                │
│ Events        │                                                │
│ Authentication│                                                │
│ Settings      │                                                │
└───────────────┴─────────────────────────────────────────────┘
```

Requirements:

- Use the existing `AdminPageHeader`/`ViewHeader`, `DetailTabs`, `admin-panel-card`, `DataTable`, `ResourceFilters`, and `admin-form-actions` primitives.
- Keep the sidebar order stable: overview, resources, security/session areas, events, then settings.
- On narrow screens the sidebar becomes the existing off-canvas navigation; content cards remain single-column.
- Page titles and descriptions are localized. Route changes do not change the shell or button grammar.
- Loading uses a status region, empty state uses a distinct message, and request failures use the shared alert pattern.
- Any hidden navigation item must also be protected by an API authorization rule.

### Dashboard

Keycloak presents the selected realm as the context for administration. The application dashboard should show the single configured issuer, active signing-key status, recent administrative events, session summary, and links to the primary resource areas. It should not show a realm selector until all resources are realm-scoped.

### Users

List layout:

- page header with user count and Create user action;
- search and filters for username, email, enabled state, and required action;
- paginated table with username, email, enabled state, MFA state, groups, and last activity;
- row menu for View/Edit, disable/enable, impersonate where authorized, and delete where allowed.

Detail layout:

- profile card;
- credentials and required actions card;
- group membership card;
- realm/client role mappings card;
- sessions and consents cards;
- user events card when the user-event stream exists.

Mutating actions remain inside the relevant card and invalidate affected sessions/authorizations in the same transaction.

### Groups

List layout:

- page header with Create group action;
- search field and stable path/name sort;
- tree/path-aware table with group name, parent path, member count, and inherited-role indicator;
- row action for View/Edit and membership management.

Detail layout:

- group name/path card;
- attributes card for multi-valued key/value attributes;
- child groups card;
- members card with add/remove actions;
- direct role mappings and effective inherited role mappings shown separately.

The project supports hierarchical groups and parent role inheritance, multi-valued attributes, default-group assignment for newly created users, configurable client-scope group claims, and inherited group-scoped permissions. Broader Keycloak protocol-mapper types and realm boundaries remain outside this single-issuer application.

### Roles

The role list should distinguish realm roles and client roles once the role model is expanded. The detail screen should show description, composite children, users, groups, and client scope mappings. A role deletion or composite update requires cycle validation, audit logging, cache eviction, and access invalidation.

### Clients

List layout:

- page header with Register client action;
- search, enabled/protocol filters, and stable client ID sort;
- table with client ID, protocol, access type, enabled state, and authentication method.

Detail tabs:

1. **General**: client ID, name, description, protocol, enabled state.
2. **Capabilities**: grant types, PKCE, consent, device/PAR options.
3. **Login settings**: redirect URIs, post-logout URIs, origins, and login theme.
4. **Credentials**: secret status, rotation, service account, and authentication method.
5. **Client scopes**: default and optional scope assignments.
6. **Roles**: client-scoped roles and composite relationships.
7. **Mappers**: protocol mapper list, create/edit drawer or card, and token preview.
8. **Sessions/consents/events**: client-specific operational views where supported.

The current project already has a multi-step client create/edit flow, redirect URI validation, secret rotation, scopes, sessions, consents, and events. The missing layout sections should be added only when their backend contracts exist.

### Authentication

Authentication is the home for sign-in policy controls, matching Keycloak's Authentication area. The current implementation exposes the policy family with stable nested routes:

```text
Authentication
└── Policies
    ├── Password policy
    ├── OTP policy
    └── WebAuthn policy
```

Policy screens use the same shared settings card and form action row as the rest of the console. The legacy `/admin/settings/password-policy`, `/admin/settings/otp-policy`, and `/admin/settings/webauthn` URLs redirect to the new Authentication policy routes so saved bookmarks continue to work. Full flow graph editing remains a roadmap item until the backend can persist and execute configurable flow steps.

### Settings

Settings is a single page family with a stable tab strip:

```text
Settings
├── General
├── Login
├── Email
├── Brute force
├── Sessions
├── Events
└── User profile
```

Each tab uses the same card and form grammar:

- a card title and description;
- controls in one vertical column with shared spacing;
- field-level validation under the owning control;
- Save at the bottom in `admin-form-actions`;
- inline spinner without changing the button label;
- localized success/error alert outside or above the card;
- viewer access renders disabled controls and no Save action.

### Login and registration CAPTCHA

The Login Settings screen includes a Keycloak-style CAPTCHA policy card for the public
registration and login flows. The two flows have independent enable switches, while the
provider and public/verification credentials are shared so administrators do not have to
configure the same site key twice:

```text
Login settings / CAPTCHA
├── Require CAPTCHA during registration       [switch]
├── Require CAPTCHA during login              [switch]
├── Provider                                  [Google reCAPTCHA | reCAPTCHA Enterprise]
├── Site key                                  [                    ]
├── Secret/API key                            [                    ]
├── Registration action                       [register]
├── Login action                              [login]
├── Registration v3 and score threshold       [switch] [0.70]
├── Login v3 and score threshold              [switch] [0.70]
└── Use recaptcha.net                         [switch]
```

The administrator API is `GET/PUT /api/admin/settings/registration-captcha`. Public
configuration is exposed through `GET /api/auth/registration-captcha` and
`GET /api/auth/login-captcha`; these responses contain only the enabled flag, provider,
site key, action, version, and host selection. Secret/API key values are encrypted at rest
and are never returned to the browser. The default policy keeps both flows disabled.

For registration, the browser obtains a v2 checkbox token or a v3 action token before
submitting the account form. For login, the same client-side token flow is followed by a
server-side `POST /login` filter that verifies the token before Spring Security evaluates
the username and password. Missing, expired, invalid, or low-score tokens stop the flow
and return the localized CAPTCHA error. A successful v2 checkbox hides the widget while
retaining the token for the form submission; an expired token makes the widget available
again. The Enterprise path validates the project ID/API key and uses the Enterprise score
and action policy.

This is an application-level parity extension around Keycloak's registration protection:
the login switch is explicit because login CAPTCHA is not assumed to be enabled for every
realm. The setting remains backend-authoritative; hiding or disabling the UI never bypasses
server verification. Focused service/filter tests and HTTP tests cover disabled defaults,
secret redaction, token verification, redirect behavior, and successful filter continuation.

### User Profile Settings

The User Profile tab provides the single-issuer equivalent of Keycloak's configurable user-profile schema. It follows the same page shell, tab strip, card width, spacing, validation placement, and bottom action row as Login, Email, and Event Settings. There is no realm selector because this application has one issuer and one shared data space.

```text
Settings / User profile
┌────────────────────────────────────────────────────────────┐
│ User profile                                                │
│ Define custom attributes shown on user and account forms.   │
│                                                             │
│ Add attribute                                               │
│ Name [department]  Display name [Department]                │
│ Type [String]      Required [ ]  Multi-valued [ ]           │
│ Min length [ ]     Max length [ ]  Pattern [                 ]│
│ Description [                                             ] │
│                                                             │
│ Configured attributes                                      │
│ Name | Type | Required | Multi-valued | Enabled | Delete     │
│ ...                                                         │
└────────────────────────────────────────────────────────────┘
```

Supported definition controls are `STRING`, `EMAIL`, `INTEGER`, and `BOOLEAN`; requiredness, single/multi-valued behavior, minimum/maximum length, regular-expression validation, enabled state, display order, and a localized description are stored with each definition. Built-in fields such as username, first name, last name, and email remain fixed fields and cannot be redefined as custom attributes.

The admin API is `GET/POST /api/admin/settings/user-profile` for definitions and `PUT/DELETE /api/admin/settings/user-profile/{id}` for changes. User values are exposed through `GET/PUT /api/admin/users/{id}/profile-attributes`; the Account Console uses `GET/PUT /api/account/profile/attributes`. Every mutation validates the submitted values, records an audit event, evicts affected cached data, and invalidates the user's browser sessions and OAuth authorizations when a value changes. The form must show an inline spinner while saving, keep the Save label, disable duplicate submissions, and place field errors directly below the affected control.

### Event Settings

The Event Settings screen is deliberately separate from the history table:

```text
Settings / Events
┌───────────────────────────────────────────────┐
│ Event settings                                │
│ Control event recording, details and retention │
│                                               │
│ [switch] Enable event recording               │
│ [switch] Enable administrative events         │
│ [switch] Include event details                │
│ Retention (days) [                    ]        │
│ Use 0 to retain events indefinitely.          │
│                                               │
│                         [ Save event settings ]│
└───────────────────────────────────────────────┘
```

This placement matches the existing Login and Email Settings screens. The Save action must not float into the card header or sit beside controls. The screen loads through `GET /api/admin/events/config`, saves through `PUT /api/admin/events/config`, and uses the manager authority for mutation.

### Events history

```text
Events
┌────────────────────────────────────────────────────────┐
│ Events                         [count]                  │
│ Audit history for administration and account actions.   │
│                                                         │
│ [Clear all events]                                      │
│ [Search] [filters] [sort]                               │
│                                                         │
│ Time | Action | Actor | Target | Details                │
│ ...                                                     │
│ Pagination                                              │
└────────────────────────────────────────────────────────┘
```

The history table is read-focused. Clear is a danger action in the shared action row, manager-only, and protected by a confirmation dialog. When user events are added, use two tabs or an explicit stream selector so administrative audit records and user authentication events remain distinguishable.

### Sessions and consents

Session screens list active sessions with device/IP/time metadata, support row-level revoke, and provide a manager-only bulk revoke where the product requires it. Consent screens list client, scopes, grant time, and revoke action. Both screens must preserve pagination and invalidate the matching authorization/session state after mutation.

### Account Console

The Account Console should retain a user-centered layout: profile, password, MFA/recovery codes, sessions, consents, required actions, and logout. Dynamic user-profile attributes and WebAuthn devices should appear as additional cards without changing the existing navigation or card grammar. The WebAuthn card now supports passkey registration, credential labels, inventory, and deletion; the browser's native ceremony remains responsible for authenticator verification.

### Social identity brokering (implemented subset)

The application now implements the OAuth2/OIDC identity-broker subset needed for Google, GitHub, LinkedIn, and Microsoft:

- Social login is disabled by default. The public login page discovers only administrator-enabled providers from `GET /api/auth/social-providers`; an enabled provider without credentials remains visible but disabled. Provider callbacks use `/login/oauth2/code/{registrationId}`.
- Administrators manage each provider's Client ID and Client Secret from `/admin/settings/login` through `/api/admin/settings/social-providers`. Client Secrets are never returned to the UI and are persisted encrypted with AES-GCM in `login_settings`; `SOCIAL_LOGIN_ENCRYPTION_KEY` must remain stable across restarts. Registration metadata can start empty and is refreshed after an admin update.
- Each identity-provider catalog entry also stores an allowlisted `iconKey`. The login and Account Console render that key through the shared icon registry, while unknown values fall back to the generic globe icon; remote icon URLs and arbitrary icon names are not accepted.
- Provider administration also exposes Keycloak-compatible `Requires short state parameter` and `Case-sensitive username` switches. Short state replaces the outbound broker state with a compact cryptographically random value, while username mapping preserves the provider's original case only when enabled and otherwise lower-cases it.
- Administrators can configure each provider's alias, login-page visibility, account-linking-only mode, GUI order, and Account Console visibility (`always`, `when-linked`, or `never`). Aliases are validated for uniqueness and are used in callback and account-link URLs. A hidden provider remains available through an explicit provider redirect, while an account-linking-only provider is rejected for new public logins and accepted only from an authenticated account-link flow.
- A first successful provider login creates a local user with a deterministic provider/subject-derived username, imported profile data, a random encoded local password, and only `ROLE_USER`. A previously linked `(provider, subject)` reuses the existing local user.
- The standard OIDC `picture` claim and provider avatar aliases (`avatar_url`, `profile_image_url`) are imported as a validated HTTPS avatar URL. Local uploads take precedence, and the URL is exposed through the account/admin avatar views and the OIDC `picture` claim without downloading third-party image bytes.
- An existing local email is never silently linked. The verified provider subject is kept server-side and the user must complete local authentication before the link is created, matching the safe part of Keycloak's First Broker Login behavior.
- The Account Console security page exposes `Bağla` for configured, unlinked providers and a confirmed `Kaldır` action for linked providers. A linked provider remains removable even if an administrator later disables it. Provider subjects remain server-side, and `social_identities` enforces a unique `(provider, subject)` link with a cascading user foreign key.
- The implementation rejects provider login when that identity provider is disabled in the persisted provider catalog, rejects disabled or locked local accounts after a successful provider callback, prevents a second identity from being silently attached for the same provider, and only trusts an explicit `email_verified` claim for newly imported accounts.
- Administrators can independently enable encrypted provider-token storage and token readability for each provider. Successful broker logins persist the access token, optional refresh token, expiry, type, and scopes in `social_identities`; the authenticated Account API exposes them at `GET /api/account/social-links/{provider}/token` only when readability is enabled. Token fields are cleared when storage is disabled and are never included in provider-list responses.
- Each provider has a server-enforced security policy for trusting the returned email, requiring named claims, and requiring an enrolled TOTP step-up after broker authentication. Provider enablement remains independently controlled and is checked again at callback time.
- OIDC logout records the provider used by the browser session and resolves the upstream logout endpoint from the provider's OpenID configuration when an `end_session_endpoint` is published. Google, Microsoft, GitHub, and LinkedIn use their provider logout flows before returning to the registered post-logout URI; providers without a usable upstream endpoint still receive local OIDC logout. Token revocation and provider-specific API proxy calls remain explicit future work.
- The implemented boundary is intentional: first/post-login flow selection, SAML, LDAP/Active Directory federation, broader provider mapper types, realm-scoped broker settings, and Keycloak's broader provider catalog are not included in this application. Provider-level `LEGACY`, `IMPORT`, `READ_ONLY`, and `FORCE` synchronization policies are supported; mapper-level overrides can inherit the provider policy or explicitly select a mode.

## Product requirements by priority

### P0 — complete the current authorization model

- Keep the current roles and event settings behavior stable.
- Add realm/client ownership to role, client scope, group, and mapper models before multi-tenant support.
- Keep client roles, composite-role expansion, standard role claims, and scope filtering stable; realm ownership remains the next role-model increment.
- Extend group attributes and add protocol mappers; dynamic user profile attributes are implemented for the single issuer.
- Keep Settings and Events visually consistent with the existing screens.
- Maintain session/token invalidation, audit events, cache eviction, OpenAPI schemas, localized messages, native hints, and tests for each mutation.

### P1 — close identity and administration gaps

- Complete WebAuthn/passkey parity. Registration, primary-factor sign-in, OTP step-up, account/admin inventory, device metadata, label management, deletion, configurable mediation, RP/authenticator ceremony policy, AAGUID allowlists, conditional sign-in, automatic passkey autofill, and standard/passwordless required enrollment are implemented. The remaining work is configurable authentication-flow composition.
- Add user event persistence and separate User events history.
- Add fine-grained resource permissions for users, groups, clients, roles, and events.
- Add service-account-specific offline-session policy and broader not-before controls if required by consuming clients.
- Add authentication-flow configuration only after a stable execution model is designed.

### P2 — optional Keycloak platform parity

- Extend the implemented identity-broker subset with SAML, LDAP/AD federation, broader provider mapper types, additional provider types, and realm-scoped broker configuration.
- Organizations and organization groups.
- Authorization Services/UMA.
- Event listeners, webhooks, delivery retries, and metrics.
- SCIM, provider SPI, and custom storage extensions.

## Open decisions

1. Does the product need multiple isolated realms, or is one issuer a permanent demo constraint?
2. Should the existing `ROLE_CLIENT_*` administration authorities remain realm roles for compatibility, or also gain a future client-management permission bridge?
3. Which user and group attributes are allowed to enter tokens, and which must be redacted?
4. Is the first user-event release limited to authentication events, or does it include account and required-action events?
5. Which external identity providers and directory protocols justify their operational cost?
6. Is resource-server authorization with UMA needed, or are Spring Security authorities sufficient for this product?

## API and persistence requirements

### Application endpoints

| Method | Path | Purpose | Required access |
| --- | --- | --- | --- |
| `GET` | `/api/admin/events/config` | Read event settings | Event viewer or administrator |
| `PUT` | `/api/admin/events/config` | Update event settings | Event manager or administrator |
| `GET` | `/api/admin/events` | Paginated event history | Event viewer or administrator |
| `DELETE` | `/api/admin/events` | Clear event history | Event manager or administrator |
| `GET` | `/api/admin/clients/{clientId}/roles` | List client-scoped roles | Client viewer or administrator |
| `POST` | `/api/admin/clients/{clientId}/roles` | Create a client-scoped role | Client manager or administrator |
| `GET` | `/api/admin/clients/{clientId}/roles/{roleId}` | Read a client role and user mappings | Client viewer or administrator |
| `PUT` | `/api/admin/clients/{clientId}/roles/{roleId}` | Update a client role | Client manager or administrator |
| `DELETE` | `/api/admin/clients/{clientId}/roles/{roleId}` | Delete an unassigned client role | Client manager or administrator |
| `POST` | `/api/admin/clients/{clientId}/roles/{roleId}/users` | Assign a user to a client role | Client manager or administrator |
| `DELETE` | `/api/admin/clients/{clientId}/roles/{roleId}/users/{userId}` | Remove a user from a client role | Client manager or administrator |
| `POST` | `/api/admin/clients/{clientId}/roles/{roleId}/groups/{groupId}` | Assign a group to a client role | Client manager or administrator |
| `DELETE` | `/api/admin/clients/{clientId}/roles/{roleId}/groups/{groupId}` | Remove a group from a client role | Client manager or administrator |

The update endpoint returns the persisted settings representation. The delete endpoint returns no content on success and a centralized Problem Detail response on failure. DTOs must use explicit OpenAPI schemas, examples, requiredness, and validation metadata. Collection endpoints must use bounded `Pageable` input, a stable default sort, and no unbounded response.

### Data model

Event settings require a durable configuration row with:

- event recording enabled;
- administrative events enabled;
- administrative representation/details enabled;
- retention in days or an explicitly documented provider unit;
- created/updated audit metadata.

Event records require an immutable identifier, actor, action/type, target type, target identifier, occurred-at timestamp, and optional details. Foreign-key and filter/order indexes must be added in the existing table changelog for bootstrap changes. New schema changes must be separate Liquibase XML files included from the master changelog, and seed rows must remain CSV-managed where appropriate.

Reference/configuration entities may use Hibernate second-level cache only when the cache region is registered in `CacheConfig` and invalidated by the same service transaction that updates the entity. Event records and high-churn history must remain uncached.

### Native image and resource behavior

Liquibase changelogs, CSV seed data, and i18n bundles must remain available to native builds through focused runtime hints. The existing agent rule already includes the changelog and data resource trees; do not add redundant wildcard registrations for those paths.

## Screen behavior and accessibility

- Every asynchronous save, clear, test, or delete action shows an inline progress spinner while retaining its normal label and disables repeated submission.
- All forms use the shared React Hook Form and Zod boundary, `noValidate`, localized validation messages, and field-level feedback.
- Alerts are announced with appropriate status semantics and remain visible long enough for a keyboard and screen-reader user to understand the result.
- Switches and number fields have associated labels, visible focus states, and usable error text.
- Destructive clear operations require confirmation and explain that the action cannot be undone.
- Tables support keyboard access to details, preserve sort/filter state across pagination, and announce an empty state distinctly from a loading state.
- Read-only viewers see values and explanatory text but do not receive enabled mutation controls.

## Acceptance criteria

### Information architecture

- [ ] The admin shell presents Settings and Events as separate destinations.
- [ ] Settings contains an Events section at `/admin/settings/events`.
- [ ] Events history is available at `/admin/events` and does not duplicate the settings form.
- [ ] Settings tabs and cards match the existing application layout at desktop and mobile widths.
- [ ] Non-admin event viewers/managers see only the Events settings section when they open Settings.

### Event Settings

- [ ] The settings card loads from the API before Save is enabled.
- [ ] Controls are vertically stacked and use the shared spacing and card classes.
- [ ] Save is at the bottom of the form in the shared `admin-form-actions` row.
- [ ] Save shows a spinner, disables repeated submission, resets to the response, and shows localized success/error feedback.
- [ ] Viewer access is read-only and manager access is write-enabled.
- [ ] Invalid retention values are rejected in the browser and by the API.

### Events history

- [ ] History is paginated, newest-first by default, and filterable.
- [ ] Event details are available without exposing JPA entities directly.
- [ ] Clear all requires confirmation, is manager-only, refreshes the table, and creates an audit record.
- [ ] Empty, loading, forbidden, and server-error states are distinct.

### Social identity brokering

- [x] Google, GitHub, LinkedIn, and Microsoft provider discovery and OAuth2/OIDC callback flows are supported.
- [x] Social login is disabled by default, provider toggles are enforced server-side, and unconfigured providers cannot start a browser redirect.
- [x] First login creates a `ROLE_USER` local account, reuses an existing provider-subject link, and does not silently link by email.
- [x] Existing-email collisions require local re-authentication before account linking.
- [x] Administrators can update Client IDs and rotate Client Secrets without exposing secrets to the browser; secrets are encrypted at rest.
- [x] Account security exposes configured connect and linked remove flows, including removal of a link after its provider is disabled.
- [x] Persisted provider disablement, local-account enabled/locked checks, same-provider link protection, and explicit provider email-verification handling are enforced server-side.
- [x] Provider, account-link, persistence, API, UI, spinner, duplicate-click, and empty-credential startup behavior have focused test coverage.
- [x] Provider aliases, hide-on-login, account-linking-only, GUI order, and Account Console visibility are configurable and enforced.
- [x] Provider-level encrypted token storage and an authenticated readable-token API are configurable and enforced; readable access requires storage to be enabled.
- [x] Social profile picture claims are imported as validated HTTPS URLs with local-avatar precedence and OIDC `picture` propagation.
- [x] OIDC logout discovers generic OIDC `end_session_endpoint` metadata and starts upstream Google, Microsoft, GitHub, or LinkedIn logout when the linked browser session identifies one of those providers.
- [x] Provider-level trust-email policy, required-claim validation, MFA step-up, and callback-time enablement checks are enforced and configurable.
- [x] Provider-level short state parameters and case-sensitive username mapping are configurable and enforced.
- [ ] Provider-level first/post-login flow selection remains future parity work.
- [ ] SAML, LDAP/AD, broader provider mapper types, additional provider types, and realm-scoped broker configuration remain future parity work.

### Client roles

- [x] Administrators can create, update, list, and delete client-scoped roles from the client detail screen.
- [x] Client roles support direct user and group mappings, with affected user sessions and authorizations invalidated after changes.
- [x] Client roles are emitted under `resource_access.{client_id}.roles` only when the `roles` scope is authorized for the token.
- [x] Client role names, ownership, duplicate protection, assignment protection, localized validation, audit events, OpenAPI schemas, and bounded user lists are enforced server-side.
- [x] Composite client roles are cycle-protected, auditable, cache-invalidating, and reflected in effective token roles.
- [ ] Realm/tenant ownership remains future parity work.

### Quality and security

- [x] Registration and login CAPTCHA settings have separate enablement, encrypted provider credentials, v2/v3 action and score policies, public configuration endpoints, server-side token verification, localized failure handling, and focused unit/HTTP coverage.
- [ ] Controller, service, authorization, persistence, and UI tests cover viewer and manager decisions.
- [ ] OpenAPI documentation reflects the actual request and response contracts.
- [ ] Liquibase migrations, cache regions, native hints, localized strings, and audit behavior are verified.
- [ ] `./mvnw verify`, frontend formatting, type checking, linting, and unit tests pass.

## Current implementation mapping and gaps

The current application implements the recommended split with `/admin/settings/events` for event configuration and `/admin/events` for history. The Settings navigation includes Events, the event form uses the shared card and action-row pattern, and the history page owns filtering and clear-history behavior. The backend exposes the four resource-oriented endpoints listed above and protects them with viewer/manager/admin rules.

Client roles are implemented as client-owned role entities with direct user and group mappings plus cycle-protected composite relationships. The client detail screen exposes a Roles tab backed by bounded administration endpoints. When a token requests the `roles` scope, effective global roles are emitted under `realm_access` and effective roles for every client represented in the unified composite graph are emitted under `resource_access`; role and composite changes invalidate affected sessions and persisted authorizations. Multi-realm ownership and client-scope role filtering remain intentionally outside this increment.

Fine-grained administration is intentionally kept as a separate capability from composite-role modeling. The composite endpoints currently use the application's existing administrative role guards; when the fine-grained permission evaluator is introduced, these mutations should additionally require Keycloak-compatible `map-role-composite` and `map-roles-composite` permissions. This dependency is tracked under the separate Fine-grained admin permissions item rather than being folded into the role graph.

The following parity items remain product decisions rather than silent assumptions:

1. **User-event storage and UI**: Keycloak has a first-class user-event stream; the current application's stored stream is administrative. Add a separate event type and UI only when login/account event capture is required.
2. **Saved event types**: Keycloak lets administrators choose which user event types are persisted. Add an allow-list field and an accessible selection dialog when user events are introduced.
3. **Event listeners**: Keycloak exposes listener providers. Add this only with a durable provider model and delivery observability.
4. **Representation details**: The current boolean expresses the policy. Persisting request JSON requires a bounded representation column, redaction rules, and a storage-size limit before enabling it for sensitive data.
5. **Realm isolation**: The current issuer is single-realm from the administrator's perspective. A future multi-tenant design must add a tenant/realm boundary to every resource, cache key, audit record, and authorization check.
6. **Forgot-password reset flow and OTP behavior**: The application now exposes reset-token lifespan, resend cooldown, and none/if-configured/required OTP reset policy in Login settings, and consumes the policy during reset. A durable execution model for composing the complete reset-credential flow is still outside the application's single-issuer scope.
7. **Social identity brokering**: The Google/GitHub/LinkedIn/Microsoft and dynamic OIDC subset is implemented with Keycloak-like provider-subject reuse, safe first-broker linking, admin-managed encrypted credentials, provider sync modes, mapper overrides, and account-console link/unlink behavior. Full Keycloak parity still requires SAML, LDAP/AD federation, broader provider mapper types, a larger provider catalog, and realm-scoped broker configuration.

## Delivery plan

### Phase 1: Consistent administration shell

Keep the existing resource pages, Settings tab strip, Events history, shared cards, action rows, localized feedback, and role-gated navigation consistent. Complete contract tests and browser checks for viewer and manager flows.

### Phase 2: Keycloak event parity

Add user-event records, saved event types, separate user/admin history tabs, event-type filtering, and representation detail display. Preserve bounded pagination, redaction, retention, and clear-action auditing.

### Phase 3: Extensibility and realm boundaries

Add listener providers, delivery status, tenant/realm isolation, and the remaining resource areas only after their APIs, permission model, persistence, cache behavior, and tests are defined.

## Sources

[^1]: Keycloak, *Server Administration Guide*, current documentation (Admin Console layout, realms, Realm Settings, realm-management roles): <https://www.keycloak.org/docs/latest/server_admin/>
[^2]: Keycloak, *Server Administration Guide 21.0.2*, “Configuring auditing to track events” (user events, admin events, Include Representation, clear actions, event listeners): <https://www.keycloak.org/docs/21.0.2/server_admin/index.html>
[^3]: Keycloak, *Admin REST API*, current documentation (`events/config`, event history, delete-all events, filters): <https://www.keycloak.org/docs-api/latest/rest-api/index.html>
[^4]: Keycloak, *RealmAdminResource Javadocs*, current API signatures for user and admin event history and filters: <https://www.keycloak.org/docs-api/latest/javadocs/org/keycloak/services/resources/admin/RealmAdminResource.html>
[^5]: Keycloak, *RealmResource Javadocs*, event and admin-event client resource methods: <https://www.keycloak.org/docs-api/26.6.4/javadocs/org/keycloak/admin/client/resource/RealmResource.html>
[^6]: Keycloak, *Server Administration Guide*, groups and group membership administration: <https://www.keycloak.org/docs/latest/server_admin/#_groups>
[^7]: Keycloak, *Authorization Services Guide*, resources, scopes, policies, permissions, UMA, and RPT: <https://www.keycloak.org/docs/latest/authorization_services/>
[^8]: Keycloak, *Server Administration Guide*, authentication flows and required actions: <https://www.keycloak.org/docs/latest/server_admin/#_authentication-flows>
[^9]: Keycloak, *Server Administration Guide*, identity brokering and user federation: <https://www.keycloak.org/docs/latest/server_admin/#_identity_brokering>
[^10]: Keycloak, *Server Administration Guide*, Organizations: <https://www.keycloak.org/docs/latest/server_admin/#_organizations>
[^11]: Keycloak, *Server Administration Guide*, protocol mappers and client scopes: <https://www.keycloak.org/docs/latest/server_admin/#_client_scopes>
[^12]: Keycloak, *Securing Applications and Services Guide*, token exchange and advanced OAuth capabilities: <https://www.keycloak.org/securing-apps/token-exchange>
[^13]: Keycloak, *MCP authorization server guide*, current resource-parameter support status: <https://www.keycloak.org/securing-apps/mcp-authz-server>
