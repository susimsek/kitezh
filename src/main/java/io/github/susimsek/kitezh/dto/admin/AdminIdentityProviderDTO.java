package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminIdentityProvider",
        description = "Keycloak-style identity provider configuration.")
public record AdminIdentityProviderDTO(
        @Schema(
                        description = "Internal provider id.",
                        example = "8d2f...",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Spring registration id.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String registrationId,
        @Schema(
                        description = "Provider implementation type.",
                        example = "oidc",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerType,
        @Schema(
                        description = "Display name on login and account pages.",
                        example = "Google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Unique provider alias.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @Schema(
                        description = "Allowlisted icon key rendered by login and account UIs.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String iconKey,
        @Schema(description = "Use a shorter OAuth state value for this provider.")
                boolean shortStateParameter,
        @Schema(description = "Preserve case when importing provider usernames.")
                boolean caseSensitiveUsername,
        @Schema(description = "Whether the provider is enabled.") boolean enabled,
        @Schema(description = "Whether credentials are configured.") boolean configured,
        @Schema(description = "Hide from the login page.") boolean hideOnLogin,
        @Schema(description = "Allow linking only.") boolean accountLinkingOnly,
        @Schema(description = "Trust provider email claims.") boolean trustEmail,
        @Schema(description = "Require MFA after provider login.") boolean mfaRequired,
        @Schema(description = "Required claims, comma separated.") String requiredClaims,
        @Schema(description = "Store provider tokens.") boolean storeTokens,
        @Schema(description = "Allow reading stored provider tokens.") boolean storedTokensReadable,
        @Schema(description = "Login page order.") int guiOrder,
        @Schema(
                        description = "Account Console visibility.",
                        allowableValues = {"always", "when-linked", "never"})
                String showInAccountConsole,
        @Schema(
                        description =
                                "User synchronization mode: legacy, import, read_only, or force.",
                        allowableValues = {"legacy", "import", "read_only", "force"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String syncMode,
        @Schema(description = "Client id.") String clientId,
        @Schema(description = "Whether a client secret is configured.")
                boolean clientSecretConfigured,
        @Schema(description = "Authorization endpoint.", nullable = true) String authorizationUri,
        @Schema(description = "Token endpoint.", nullable = true) String tokenUri,
        @Schema(description = "User-info endpoint.", nullable = true) String userInfoUri,
        @Schema(description = "JWK set endpoint.", nullable = true) String jwkSetUri,
        @Schema(description = "Issuer endpoint.", nullable = true) String issuerUri,
        @Schema(description = "OAuth client authentication method.")
                String clientAuthenticationMethod,
        @Schema(description = "Requested scopes.") String scopes,
        @Schema(description = "User-name claim.") String userNameAttribute,
        @Schema(description = "Number of configured mappers.") long mapperCount) {}
