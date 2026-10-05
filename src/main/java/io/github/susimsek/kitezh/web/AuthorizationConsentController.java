package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.dto.oauth.AuthorizationConsentDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.security.Principal;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsent;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@Tag(name = "OAuth2 / OIDC", description = "Authorization and consent-screen support endpoints.")
public class AuthorizationConsentController {

    private final RegisteredClientRepository registeredClientRepository;
    private final OAuth2AuthorizationConsentService authorizationConsentService;

    public AuthorizationConsentController(
            RegisteredClientRepository registeredClientRepository,
            OAuth2AuthorizationConsentService authorizationConsentService) {
        this.registeredClientRepository = registeredClientRepository;
        this.authorizationConsentService = authorizationConsentService;
    }

    @GetMapping("/api/authorization/consent")
    @Operation(
            summary = "Get authorization consent data",
            description =
                    "Validates the OAuth2 request and returns the scopes that still require"
                            + " approval.")
    @ApiResponse(responseCode = "200", description = "Consent-screen data returned.")
    AuthorizationConsentDTO consent(
            Principal principal,
            @Parameter(
                            description = "OAuth2 registered client identifier.",
                            example = "account-console",
                            required = true)
                    @RequestParam(OAuth2ParameterNames.CLIENT_ID)
                    String clientId,
            @Parameter(
                            description = "Space-delimited OAuth2 scopes requested by the client.",
                            example = "openid account-api",
                            required = true)
                    @RequestParam(OAuth2ParameterNames.SCOPE)
                    String scope,
            @Parameter(
                            description = "Opaque state value returned to the client.",
                            example = "abc123state",
                            required = true)
                    @RequestParam(OAuth2ParameterNames.STATE)
                    String state,
            @Parameter(
                            description = "Optional device authorization user code.",
                            example = "ABCD-EFGH")
                    @RequestParam(name = OAuth2ParameterNames.USER_CODE, required = false)
                    String userCode) {

        RegisteredClient registeredClient = registeredClientRepository.findByClientId(clientId);
        if (registeredClient == null) {
            throw new IllegalArgumentException("Invalid client");
        }

        Set<String> requestedScopes =
                new LinkedHashSet<>(
                        Arrays.asList(StringUtils.delimitedListToStringArray(scope, " ")));
        if (!registeredClient.getScopes().containsAll(requestedScopes)) {
            throw new IllegalArgumentException("Invalid scope");
        }

        OAuth2AuthorizationConsent currentConsent =
                authorizationConsentService.findById(registeredClient.getId(), principal.getName());

        Set<String> previouslyApprovedScopes =
                currentConsent != null ? currentConsent.getScopes() : Set.of();

        Set<String> scopesToApprove = new LinkedHashSet<>();
        Set<String> approvedScopes = new LinkedHashSet<>();

        for (String requestedScope : requestedScopes) {
            if (OidcScopes.OPENID.equals(requestedScope)) {
                continue;
            }
            if (previouslyApprovedScopes.contains(requestedScope)) {
                approvedScopes.add(requestedScope);
            } else {
                scopesToApprove.add(requestedScope);
            }
        }

        String requestUri =
                StringUtils.hasText(userCode) ? "/oauth2/device_verification" : "/oauth2/authorize";

        return new AuthorizationConsentDTO(
                clientId,
                state,
                scopesToApprove,
                approvedScopes,
                principal.getName(),
                userCode,
                requestUri);
    }
}
