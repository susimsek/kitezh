package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminIdentityProviderRequest",
        description = "Identity provider create or update request.")
public record AdminIdentityProviderRequestDTO(
        @Schema(
                        description = "Provider registration id.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "[a-z0-9][a-z0-9_-]{0,49}")
                String registrationId,
        @Schema(
                        description =
                                "Provider type: google, github, linkedin, microsoft, or oidc.",
                        example = "oidc",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 50)
                String providerType,
        @Schema(
                        description = "Display name.",
                        example = "Acme SSO",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String displayName,
        @Schema(
                        description = "Unique login alias.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "[a-z0-9][a-z0-9_-]{0,49}")
                String alias,
        @Schema(
                        description = "Allowlisted icon key rendered by login and account UIs.",
                        example = "generic",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "[a-z][a-z0-9_-]{0,39}")
                String iconKey,
        @Schema(description = "Use a shorter OAuth state value for this provider.")
                boolean shortStateParameter,
        @Schema(description = "Preserve case when importing provider usernames.")
                boolean caseSensitiveUsername,
        @Schema(description = "Whether the provider is enabled.") boolean enabled,
        @Schema(description = "OAuth client id.", requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 500)
                String clientId,
        @Schema(
                        description =
                                "OAuth client secret; blank on update keeps the current value.",
                        nullable = true)
                @Size(max = 1000)
                String clientSecret,
        @Schema(description = "Hide provider on login.") boolean hideOnLogin,
        @Schema(description = "Only allow account linking.") boolean accountLinkingOnly,
        @Schema(description = "Trust provider email claims.") boolean trustEmail,
        @Schema(description = "Require MFA after provider login.") boolean mfaRequired,
        @Schema(description = "Required claims, comma separated.") @Size(max = 500)
                String requiredClaims,
        @Schema(description = "Store provider tokens.") boolean storeTokens,
        @Schema(description = "Allow reading stored provider tokens.") boolean storedTokensReadable,
        @Schema(description = "Login page order.") @Min(0) int guiOrder,
        @Schema(
                        description = "Account Console visibility.",
                        allowableValues = {"always", "when-linked", "never"})
                @NotBlank
                @Pattern(regexp = "(?i)always|when-linked|never")
                String showInAccountConsole,
        @Schema(
                        description =
                                "User synchronization mode: legacy, import, read_only, or force.",
                        allowableValues = {"legacy", "import", "read_only", "force"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "(?i)legacy|import|read[_-]only|force")
                String syncMode,
        @Schema(description = "Authorization endpoint.", nullable = true) @Size(max = 1000)
                String authorizationUri,
        @Schema(description = "Token endpoint.", nullable = true) @Size(max = 1000) String tokenUri,
        @Schema(description = "User-info endpoint.", nullable = true) @Size(max = 1000)
                String userInfoUri,
        @Schema(description = "JWK set endpoint.", nullable = true) @Size(max = 1000)
                String jwkSetUri,
        @Schema(description = "Issuer endpoint.", nullable = true) @Size(max = 1000)
                String issuerUri,
        @Schema(description = "OAuth client authentication method.") @NotBlank @Size(max = 30)
                String clientAuthenticationMethod,
        @Schema(description = "Comma-separated scopes.") @NotBlank @Size(max = 1000) String scopes,
        @Schema(description = "User-name claim.") @NotBlank @Size(max = 100)
                String userNameAttribute) {}
