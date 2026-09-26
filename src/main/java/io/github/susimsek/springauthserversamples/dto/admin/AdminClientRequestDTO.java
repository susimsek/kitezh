package io.github.susimsek.springauthserversamples.dto.admin;

import io.github.susimsek.springauthserversamples.web.admin.validation.AbsoluteUri;
import io.github.susimsek.springauthserversamples.web.admin.validation.PositiveDuration;
import io.github.susimsek.springauthserversamples.web.admin.validation.ValidAdminClientConfiguration;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.Set;

@ValidAdminClientConfiguration
@Schema(
        name = "AdminClientRequest",
        description = "OAuth2/OIDC client configuration to create or update.")
public record AdminClientRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100)
                @Schema(
                        description = "OAuth2 client identifier.",
                        example = "reporting-client",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 200)
                @Schema(
                        description = "Human-readable client name.",
                        example = "Reporting Client",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientName,
        @NotEmpty(message = "{app.api.problem.violation.selection}")
                @Schema(
                        description =
                                "Client authentication methods; use `none` for a public client.",
                        example = "[\"none\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<@NotBlank(message = "{app.api.problem.violation.selection}") String>
                        clientAuthenticationMethods,
        @NotEmpty(message = "{app.api.problem.violation.selection}")
                @Schema(
                        description = "Allowed OAuth2 grant types.",
                        example = "[\"authorization_code\", \"refresh_token\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<@NotBlank(message = "{app.api.problem.violation.selection}") String>
                        authorizationGrantTypes,
        @Schema(
                        description = "Allowed authorization redirect URIs.",
                        example = "[\"http://localhost:3000/admin/callback\"]",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Set<@AbsoluteUri String> redirectUris,
        @Schema(
                        description = "Allowed post-logout redirect URIs.",
                        example = "[\"http://localhost:3000/admin\"]",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Set<@AbsoluteUri String> postLogoutRedirectUris,
        @NotEmpty(message = "{app.api.problem.violation.scope}")
                @Schema(
                        description = "Scopes available to the client.",
                        example = "[\"openid\", \"admin-api\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<@NotBlank(message = "{app.api.problem.violation.scope}") String> scopes,
        @Schema(
                        description = "Whether the user must approve requested scopes.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean requireAuthorizationConsent,
        @Schema(
                        description = "Whether PKCE is required.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean requireProofKey,
        @Schema(
                        description =
                                "Whether this client must send DPoP proofs for token requests.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean requireDpop,
        @Schema(
                        description =
                                "Whether authorization-code requests must include the DPoP key"
                                        + " thumbprint.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean requireDpopJkt,
        @Schema(
                        description =
                                "Whether refresh-token requests must include DPoP proofs without"
                                        + " binding the new access token.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean dpopRefreshTokenOnly,
        @NotEmpty(message = "{app.api.problem.violation.selection}")
                @Schema(
                        description = "Allowed DPoP proof signature algorithms for this client.",
                        example = "[\"ES256\", \"RS256\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<
                                @Pattern(
                                        regexp = "RS256|ES256",
                                        message = "{app.api.problem.violation.selection}")
                                String>
                        dpopSigningAlgorithms,
        @Schema(
                        description = "Authorization-code lifetime in ISO-8601 duration format.",
                        example = "PT5M",
                        format = "duration",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @PositiveDuration
                Duration authorizationCodeTimeToLive,
        @Schema(
                        description = "Access-token lifetime in ISO-8601 duration format.",
                        example = "PT5M",
                        format = "duration",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @PositiveDuration
                Duration accessTokenTimeToLive,
        @Schema(
                        description = "Refresh-token lifetime in ISO-8601 duration format.",
                        example = "PT8H",
                        format = "duration",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @PositiveDuration
                Duration refreshTokenTimeToLive) {

    public AdminClientRequestDTO(
            String clientId,
            String clientName,
            Set<String> clientAuthenticationMethods,
            Set<String> authorizationGrantTypes,
            Set<String> redirectUris,
            Set<String> postLogoutRedirectUris,
            Set<String> scopes,
            boolean requireAuthorizationConsent,
            boolean requireProofKey,
            Duration authorizationCodeTimeToLive,
            Duration accessTokenTimeToLive,
            Duration refreshTokenTimeToLive) {
        this(
                clientId,
                clientName,
                clientAuthenticationMethods,
                authorizationGrantTypes,
                redirectUris,
                postLogoutRedirectUris,
                scopes,
                requireAuthorizationConsent,
                requireProofKey,
                false,
                false,
                false,
                java.util.Set.of("RS256", "ES256"),
                authorizationCodeTimeToLive,
                accessTokenTimeToLive,
                refreshTokenTimeToLive);
    }
}
