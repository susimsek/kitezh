package io.github.susimsek.kitezh.dto.oauth;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;

@Schema(
        name = "AuthorizationConsent",
        description = "Data used by the browser consent screen for an OAuth2 request.")
public record AuthorizationConsentDTO(
        @Schema(
                        description = "OAuth2 client requesting authorization.",
                        example = "account-console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @Schema(
                        description = "Opaque OAuth2 state value to return to the client.",
                        example = "abc123state",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String state,
        @Schema(
                        description = "Scopes that still require user approval.",
                        example = "[\"account-api\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> scopes,
        @Schema(
                        description = "Scopes previously approved by the user.",
                        example = "[\"openid\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> previouslyApprovedScopes,
        @Schema(
                        description = "Authenticated principal name.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String principalName,
        @Schema(
                        description = "Optional OAuth2 device user code.",
                        example = "ABCD-EFGH",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String userCode,
        @Schema(
                        description = "URI used to render the consent form.",
                        example = "/oauth2/authorize",
                        format = "uri-reference",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String requestUri) {}
