# Authorization Services and UMA

The application provides a single-issuer Authorization Services API, separate from
administrator RBAC. Administrators configure resources, scopes, policies, and permissions
through `/api/admin/authorization/**`. Registered resource servers use the UMA Protection
API under `/api/authz/protection/**` with an access token containing `uma_protection`.

## Configure a resource server

Register an OAuth client for the resource server and enable the `uma_protection` scope. Use
its client-credentials token as the Protection API token (PAT):

```sh
curl -u resource-server:secret \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&scope=uma_protection' \
  http://localhost:9090/oauth2/token
```

Register a protected resource and its scopes:

```sh
curl -X POST http://localhost:9090/api/authz/protection/resources \
  -H "Authorization: Bearer $PAT" -H 'Content-Type: application/json' \
  -d '{"name":"orders","type":"order","uri":"/api/orders/*","scopes":["view","edit"]}'
```

The opaque permission ticket returned by `POST /api/authz/protection/permission` is stored
only as a SHA-256 digest, expires after 60 seconds, and can be redeemed once. Requests and
RPTs are bound to the resource and scopes represented by that ticket.

## Configure policies and permissions

An administrator with client-management authority can use the Administration API to create
policies and resource permissions. Supported policy types are `USER`, `ROLE`, `GROUP`,
`CLIENT`, `OWNER`, and `PUBLIC`; effects are `ALLOW` and `DENY`. Permission decision
strategies are `AFFIRMATIVE`, `UNANIMOUS`, and `CONSENSUS`. Policies and permissions must
belong to the same resource-server client. A scope cannot be removed while a permission
still refers to it.

The relevant endpoints are:

- `GET/POST /api/admin/authorization/resources`
- `GET/PUT/DELETE /api/admin/authorization/resources/{id}`
- `GET/POST /api/admin/authorization/policies`
- `PUT/DELETE /api/admin/authorization/policies/{id}`
- `GET/POST /api/admin/authorization/permissions`
- `PUT/DELETE /api/admin/authorization/permissions/{id}`

## UMA ticket and RPT exchange

The UMA metadata document is `/.well-known/uma2-configuration`. A protected resource server
creates a ticket with `POST /api/authz/protection/permission`:

```sh
curl -X POST http://localhost:9090/api/authz/protection/permission \
  -H "Authorization: Bearer $PAT" -H 'Content-Type: application/json' \
  -d '{"resourceId":"RESOURCE_ID","scopes":["view"]}'
```

A requesting party client must enable the
`urn:ietf:params:oauth:grant-type:uma-ticket` grant and the `uma_authorization` scope. It
exchanges the ticket at the OAuth token endpoint. `subject_token` is optional; when supplied,
it must be an active access token issued by this server to the same client and identifies the
user whose policies are evaluated:

```sh
curl -u requesting-party:secret \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=urn:ietf:params:oauth:grant-type:uma-ticket&ticket=TICKET&subject_token=USER_ACCESS_TOKEN' \
  http://localhost:9090/oauth2/token
```

The returned signed JWT is an RPT. Its `authorization.permissions` claim contains each granted
resource identifier and scope, and its audience is the resource-server client ID. A resource
server validates the JWT with the issuer's JWKS and enforces those claims for its protected
endpoints. The application issues RPTs and manages policy data; enforcement of a resource
server's own business endpoints remains in that resource server.
