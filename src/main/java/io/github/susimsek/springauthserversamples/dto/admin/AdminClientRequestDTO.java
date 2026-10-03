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
        @Pattern(regexp = "poll|ping|push", message = "{app.api.problem.violation.selection}")
                @Schema(
                        description = "CIBA backchannel token delivery mode.",
                        example = "poll",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String cibaDeliveryMode,
        @Schema(
                        description = "CIBA ping or push notification endpoint.",
                        example = "https://client.example/ciba/notify",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String cibaNotificationEndpoint,
        @Size(max = 512)
                @Schema(
                        description =
                                "CIBA client notification token. Leave blank when updating to keep"
                                        + " the current token.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String cibaClientNotificationToken,
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
                Duration refreshTokenTimeToLive,
        @Schema(
                        description = "Whether this client has a non-interactive service account.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean serviceAccountEnabled,
        @Schema(
                        description = "Client-secret lifetime in ISO-8601 duration format.",
                        example = "P90D",
                        format = "duration",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @PositiveDuration
                Duration clientSecretTimeToLive,
        @Schema(
                        description = "Whether the client may participate in authorization flows.",
                        example = "true",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean enabled,
        @Size(max = 1000)
                @Schema(
                        description = "Base URL used for client links.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String rootUrl,
        @Size(max = 1000)
                @Schema(
                        description = "Client home URL.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String homeUrl,
        @Schema(
                        description = "Allowed browser origins.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Set<@AbsoluteUri String> webOrigins,
        @Size(max = 1000)
                @Schema(
                        description = "Administration URL for the client.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String adminUrl,
        @Schema(
                        description = "Whether front-channel logout is enabled.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean frontChannelLogout,
        @Schema(
                        description = "Whether back-channel logout is enabled.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean backchannelLogout,
        @Size(max = 1000)
                @Schema(
                        description = "Client JWKS URL for private_key_jwt.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String jwkSetUrl,
        @Pattern(
                        regexp = "RS256|RS384|RS512|PS256|PS384|PS512|ES256|ES384|ES512",
                        message = "{app.api.problem.violation.selection}")
                @Schema(
                        description = "Token endpoint authentication signing algorithm.",
                        example = "RS256",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String tokenEndpointAuthenticationSigningAlgorithm,
        @Size(max = 500)
                @Schema(
                        description = "Expected certificate subject DN for tls_client_auth.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String x509CertificateSubjectDN,
        @PositiveDuration
                @Schema(
                        description =
                                "Grace period during which the previous secret remains valid.",
                        format = "duration",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Duration clientSecretGracePeriod,
        @PositiveDuration
                @Schema(
                        description = "Client override for offline session idle lifetime.",
                        format = "duration",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Duration offlineSessionIdle,
        @PositiveDuration
                @Schema(
                        description = "Client override for offline session maximum lifetime.",
                        format = "duration",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Duration offlineSessionMax,
        @Schema(
                        description =
                                "Whether token exchange requests must not increase subject-token"
                                        + " scopes.",
                        example = "true",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean tokenExchangeDownscopeOnly,
        @Schema(
                        description = "Whether this client may use RFC 8693 actor delegation.",
                        example = "false",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean tokenExchangeAllowDelegation,
        @Schema(
                        description =
                                "Client identifiers that this client may target with token"
                                        + " exchange.",
                        example = "[\"reports-api\"]",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Set<@NotBlank(message = "{app.api.problem.violation.selection}") String>
                        tokenExchangeAllowedAudiences) {

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
            boolean requireDpop,
            boolean requireDpopJkt,
            boolean dpopRefreshTokenOnly,
            Set<String> dpopSigningAlgorithms,
            Duration authorizationCodeTimeToLive,
            Duration accessTokenTimeToLive,
            Duration refreshTokenTimeToLive,
            boolean serviceAccountEnabled,
            Duration clientSecretTimeToLive) {
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
                requireDpop,
                requireDpopJkt,
                dpopRefreshTokenOnly,
                dpopSigningAlgorithms,
                null,
                null,
                null,
                authorizationCodeTimeToLive,
                accessTokenTimeToLive,
                refreshTokenTimeToLive,
                serviceAccountEnabled,
                clientSecretTimeToLive,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                false,
                java.util.Set.of());
    }

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
                refreshTokenTimeToLive,
                false,
                null);
    }

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
            boolean requireDpop,
            boolean requireDpopJkt,
            boolean dpopRefreshTokenOnly,
            Set<String> dpopSigningAlgorithms,
            String cibaDeliveryMode,
            String cibaNotificationEndpoint,
            String cibaClientNotificationToken,
            Duration authorizationCodeTimeToLive,
            Duration accessTokenTimeToLive,
            Duration refreshTokenTimeToLive,
            boolean serviceAccountEnabled,
            Duration clientSecretTimeToLive,
            Boolean enabled,
            String rootUrl,
            String homeUrl,
            Set<String> webOrigins,
            String adminUrl,
            Boolean frontChannelLogout,
            Boolean backchannelLogout,
            String jwkSetUrl,
            String tokenEndpointAuthenticationSigningAlgorithm,
            String x509CertificateSubjectDN,
            Duration clientSecretGracePeriod) {
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
                requireDpop,
                requireDpopJkt,
                dpopRefreshTokenOnly,
                dpopSigningAlgorithms,
                cibaDeliveryMode,
                cibaNotificationEndpoint,
                cibaClientNotificationToken,
                authorizationCodeTimeToLive,
                accessTokenTimeToLive,
                refreshTokenTimeToLive,
                serviceAccountEnabled,
                clientSecretTimeToLive,
                enabled,
                rootUrl,
                homeUrl,
                webOrigins,
                adminUrl,
                frontChannelLogout,
                backchannelLogout,
                jwkSetUrl,
                tokenEndpointAuthenticationSigningAlgorithm,
                x509CertificateSubjectDN,
                clientSecretGracePeriod,
                null,
                null,
                false,
                false,
                java.util.Set.of());
    }
}
