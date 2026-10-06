# SimpleSAMLphp local SAML fixture

This is an isolated development IdP, not a production service. It does not add realms to
Kitezh. The application-wide provider alias is `saml-e2e`.

## Start and configure

From the repository root, run:

```powershell
docker compose -p kitezh-saml-test -f src/main/docker/saml-test.yml up -d
./mvnw '-Dskip.frontend=true' spring-boot:run
```

In a second terminal, after readiness is healthy:

```powershell
./scripts/test-saml-e2e.ps1 -ConfigureOnly
./scripts/test-saml-e2e.ps1
```

The script uses the local `admin/admin` account and public console clients through normal
OIDC Authorization Code + PKCE and administration APIs. It imports the IdP metadata and
sets signature validation, stable `uid` identity mapping and POST response binding.
It never prints assertions or tokens. It refuses to transmit test credentials outside
the two localhost origins. Do not run it against production or a shared environment.

H2 in-memory data is lost on application restart. Run `-ConfigureOnly` again afterward.
Do not run a Java compilation concurrently with a server using the same `target/classes`.
To test fresh credentials despite an existing IdP session, use
`./scripts/test-saml-e2e.ps1 -ConfigureOnly -ForceAuthentication`. This sets the standard
SAML ForceAuthn option. Run `-ConfigureOnly` without that switch to restore normal SSO.

## Endpoint and identity contract

| Item | Value |
| --- | --- |
| Container | `saml-test-idp` |
| Metadata | `http://localhost:8082/simplesaml/saml2/idp/metadata.php` |
| SP entity ID | `http://localhost:9090/saml2/service-provider-metadata/saml-e2e` |
| ACS | `http://localhost:9090/login/saml2/sso/saml-e2e` |
| SP SLO | `http://localhost:9090/logout/saml2/slo/saml-e2e` |
| Auth source | `example-userpass` |
| Users | `user1/password`, `user2/password` |
| Principal | Stable signed `uid` attribute |
| NameID | Persistent, generated from `uid` |
| Bindings | AuthnRequest Redirect, Response POST, SLO Redirect |

Both responses and assertions are signed with RSA-SHA256. The image is pinned by digest.
An expired bundled certificate is regenerated at startup. The private key stays in a
Docker volume, is not committed, and is readable by the IdP process only. Metadata and
the certificate remain stable across normal restarts; refresh application configuration
after certificate regeneration. The fixture uses the image's original auto-submit POST
template, not a custom Continue-button workaround. Apache logs omit query strings and
the IdP DEBUG assertion logging is disabled.

The initial broker login creates a local account, not a realm. Repeated provider/subject
logins reuse that account. Only local authorities are authoritative. Email is not treated
as verified in this fixture, and email matches do not silently link accounts.

## Independent verification

HTTP checks cover both users, two fresh sessions per user, exact ACS POST, authenticated
local session, account profile, stable local username and denied administration API
access. A captured SP-initiated response replayed without its request session must fail.
`SAML_E2E=PASS` explicitly means HTTP, not browser success.
The ACS POST includes `Origin` and Fetch Metadata navigation headers, matching Chrome;
omitting these headers previously hid the application's global CORS rejection.

For Chrome, start a fresh login at `http://localhost:9090/login`, select `saml-e2e`, and
authenticate as `user1/password` on SimpleSAMLphp. Since the fixture user is not an
administrator, use the Account Console to verify the final authorized session; reaching
`/admin` alone does not prove administrative access or successful console initialization.
Repeat with `user2` after logging out of both SP and IdP sessions.

In Chrome DevTools Network, enable Preserve log before starting. The expected transport
is IdP login POST 200, an automatic form POST to the exact ACS, ACS 302, and an authenticated
application session. Do not publish SAMLResponse, RelayState, cookies, tokens, or a raw HAR.

To distinguish transport rejection from a security-filter response, start the application
with Tomcat access logging enabled and use a query-free pattern such as
`%t|%m|%U|%s|%D`. A security-filter access logger alone may not see ACS because the SAML
filter can complete the request before that logger runs. Compare the ACS request timestamp
with the Tomcat log, and verify an HTTP-script ACS appears in the same log as a control.

`ERR_BLOCKED_BY_CLIENT` is a Chromium client/network error, not an application HTTP
status. Do not attribute it to a specific extension or the connector without independent
evidence. A missing ACS transport entry, with successful control requests logged, locates
the failure before the application. A manual Chrome run outside automation is needed to
separate profile/extension policy from connector/session policy when that distinction is
not exposed by the connector. Do not change ACS, disable CSRF, weaken signature checks,
or replace POST binding merely to make the browser test pass.

In the 2026-10-06 investigation, Tomcat recorded the real Chrome ACS POST with **403**,
not a missing request. The global CORS configuration allowed only `app://renderer` and
rejected the IdP's `Origin` before Spring Security could validate the SAML response.
The application now treats exact SAML ACS/SLO form POST document navigations as protocol
messages, rather than cross-origin API reads. No `Access-Control-Allow-Origin` permission
is issued for these navigations. Preflight requests, explicit fetch requests and other
endpoints retain the original origin restrictions. Signature and request correlation
validation remain authoritative. Tests include malformed browser-style ACS messages,
denied cross-origin API/fetch requests and normal renderer CORS access.

## Boundaries and parity

Broker identity linkage and safe first-login linking follow Keycloak's model, scoped by
provider rather than realm. AuthnRequest and Response bindings are separate options;
changing the former does not change the latter. The signed POST response path is the
verified configuration. Logout endpoint metadata is checked, but a successful login
does not establish complete bidirectional signed SLO, encrypted assertion, native-image,
or production multi-IdP parity. These require their own credentials and test scenarios.

Primary references:

- [Keycloak identity broker documentation](https://www.keycloak.org/docs/latest/server_admin/index.html)
- [SimpleSAMLphp SP remote metadata](https://simplesamlphp.org/docs/stable/simplesamlphp-reference-sp-remote.html)
- [Chromium network error definitions](https://github.com/chromium/chromium/blob/main/net/base/net_error_list.h)
