# SAML browser failure investigation — 2026-10-06

## 1. Root cause

The application-wide servlet `CorsFilter` allowed only the desktop renderer origin and
applied that policy to every URL. SimpleSAMLphp's normal form POST sends an IdP `Origin`
header. The filter rejected it before the SAML authentication filter ran.

Evidence from the same running application:

- Before the fix, Chrome displayed `ERR_BLOCKED_BY_CLIENT`, but Tomcat recorded the ACS
  POST at 12:52:48 Istanbul time with **403**. It was not a missing network request.
- An HTTP ACS probe including `Origin: http://localhost:8082` also returned **403**.
- Earlier passing HTTP tests omitted `Origin`, hiding this server-side difference.
- After the fix, Chrome's automatic ACS POST returned **302** at 13:02:54; the Account
  Console loaded successfully. A fresh ForceAuthn/password login also produced ACS **302**
  at 13:06:32. The visible account had `user1@example.com` and the imported Test/One profile.
- Browser-style HTTP tests now include Origin and Fetch Metadata navigation headers and pass.

The previous attribution to an ad blocker or the connector was not supported by transport
evidence. `ERR_BLOCKED_BY_CLIENT` alone does not identify the responsible component.

## 2. Code problems addressed

- Scope CORS processing correctly for exact SAML ACS/SLO form POST document navigation.
  Return no CORS configuration for those protocol messages; do not grant cross-origin
  response-reading permission. Explicit fetch requests, preflights and other endpoints
  retain the existing origin restrictions.
- Clear both the current and persisted security context when local broker completion
  fails, instead of leaving Spring's initial SAML authentication in the session.
- Restore local account authentication after explicit account linking.
- Do not treat MFA enrollment as successful MFA verification. Enrolled users still follow
  the application's normal MFA challenge; unenrolled users cannot satisfy provider policy.
- Reject a missing configured principal attribute instead of silently falling back to a
  possibly transient NameID.
- Separate SP SLO endpoint metadata from the IdP logout URL and align the SLO filters.
- Mask SAMLResponse, SAMLRequest and RelayState in application logging. Disable upstream
  IdP DEBUG assertion logging and omit query strings from fixture access logs.

The existing post-transaction-commit registration refresh was retained and verified by an
HTTP-level integration test against a committed administration update.

## 3. Browser and connector findings

Real Chrome, through the Chrome extension connector, successfully executed IdP auto-submit,
ACS validation, OIDC callback/token exchange and Account Console rendering after the fix.
Fresh credentials were entered on SimpleSAMLphp with the standard ForceAuthn option.

Some connector click/keyboard attempts on React controls had no effect. The test opened
the real SAML href observed on the login page; it did not synthesize a SAML response or
submit it outside Chrome. Therefore, the provider-button click itself is not certified by
this run. The successful SAML transport and account UI result are independently verified.
The old IAB tab was not used as evidence for the corrected Chrome result.

Direct SAML entry without a saved client request still defaults to `/admin`. A newly
provisioned ROLE_USER account cannot use the Admin Console; the resulting access-denied
page is an authorization decision, not a failed SAML assertion. Start from `/account` for
the end-user console flow.

## 4. Fixture and SAML settings

The Docker fixture now uses a digest-pinned image and checked-in auth-source/SP metadata
configuration. It exposes port 8082 on loopback only. Both users have stable signed `uid`
attributes; NameID is persistent. The bundled expired certificate is replaced by a valid
RSA certificate in a persistent volume. No private key is committed. Original IdP automatic
POST submission is used; no custom Continue-button patch is necessary.

AuthnRequest Redirect and Response POST remain separate standard binding choices. Neither
ACS nor its response binding was changed to avoid the browser problem. The application is
the SP/broker in this integration; SimpleSAMLphp is the external IdP. No realm is introduced.

## 5. Implementation locations

- `config/CorsConfig` and `CorsConfigTest`
- `config/security/SamlLoginAuthenticationSuccessHandler` and its tests
- `service/SamlLoginService` and its tests
- `config/security/SamlRelyingPartyRegistrationRepository`, `SecurityConfig` and tests
- `config/observability/ObservabilityMdcFilter` and its tests
- `SamlLoginEndpointsIT` and the public test certificate
- `src/main/docker/saml-test.yml`, its mounted fixture files and README
- `scripts/test-saml-e2e.ps1`

Unrelated staged/unstaged changes were preserved. No commit or push was performed.

## 6. Verification results

| Check | Result |
| --- | --- |
| Spotless apply/check | Pass |
| Checkstyle | Pass, zero violations; existing Windows line-ending warnings remain |
| Focused SAML/security/CORS regression suite | 85 tests passed |
| All Java unit tests | 1,395 tests passed |
| All integration tests | 77 tests passed |
| Docker HTTP SAML E2E | Pass, both users, two independent logins each |
| SP-initiated response replay without request session | Rejected; no authenticated session |
| Chrome signed SAML POST and Account Console | Pass for user1, including fresh password login |
| Login provider-button click through connector | Not certified; input actions were unreliable |
| Native executable | Not run; native-image tooling unavailable |

HTTP checks also verify stable local usernames, imported email with `emailVerified=false`,
Account API 200 and denied administration API access. The integration regression proves a
malformed browser-style response cannot establish authentication; cross-origin fetch/API
requests remain denied. A successful 302 redirect alone was not counted as authentication.

## 7. Chrome reproduction

1. Use a new request, not an old SAMLRequest/RelayState URL left over from a previous H2 run.
2. Open `http://localhost:9090/account` and select the SAML provider on the login screen.
3. Authenticate on SimpleSAMLphp using `user1/password`.
4. Verify ACS POST 302, Account Console rendering, `user1@example.com` and Test/One.
5. Sign out normally from the console and IdP before testing user2. If an IdP session is
   being reused, `-ConfigureOnly -ForceAuthentication` requests fresh credentials.
6. Restore normal SSO using `-ConfigureOnly` without that switch.

Keep DevTools Preserve log enabled when diagnosing a failure. Correlate the ACS timestamp
with Tomcat's transport log, not only an application filter's access log. Do not share raw
assertions, cookies, tokens or unsanitized HAR files.

## 8. Backend HTTP reproduction

From the repository root:

```powershell
docker compose -p kitezh-saml-test -f src/main/docker/saml-test.yml up -d
./mvnw spring-boot:run
```

In another terminal after readiness:

```powershell
./scripts/test-saml-e2e.ps1
```

The script creates/updates the provider through authenticated administration APIs. H2
in-memory state disappears on application restart; configure the provider again afterward.
`SAML_E2E=PASS` explicitly refers to HTTP, not the Chrome UI result.

## 9. Security and Keycloak parity

The broker model uses a stable provider/subject link, first-login local provisioning,
local authorities and explicit linking after local re-authentication. An email match alone
does not link accounts. These follow Keycloak's safe broker model, scoped by provider alias
instead of realm. Missing configured principal claims fail closed.

No ACS renaming, new CSRF disabling, authentication-chain relaxation, wildcard CORS grant,
signature bypass or response-binding workaround was applied. Cross-origin form navigation
is not permission to read responses through JavaScript. SAML signature, recipient/audience,
time and request-correlation validation remain in Spring Security/OpenSAML.

This run does not establish complete encrypted-assertion, bidirectional signed SLO,
native-image or production multi-IdP parity. In particular, the local fixture does not
provide SP signing credentials for a complete signed-logout scenario. Verify those scenarios
separately before asserting full Keycloak feature parity.

Primary references:

- [Spring Security CORS integration](https://docs.spring.io/spring-security/reference/7.0/servlet/integrations/cors.html)
- [Keycloak server administration and identity brokers](https://www.keycloak.org/docs/latest/server_admin/index.html)
- [SimpleSAMLphp SP remote metadata](https://simplesamlphp.org/docs/stable/simplesamlphp-reference-sp-remote.html)
- [Chromium network error definitions](https://github.com/chromium/chromium/blob/main/net/base/net_error_list.h)
