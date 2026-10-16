package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminIdentityProviderNativePolicy",
        description = "Native-safe identity-provider policy without credentials or endpoints.")
public record AdminIdentityProviderNativePolicyDTO(
        @Schema(description = "Internal provider identifier.", example = "provider-123") String id,
        @Schema(description = "Provider display name.", example = "Acme SSO") String displayName,
        @Schema(description = "Whether the provider accepts new logins.") boolean enabled,
        @Schema(description = "Whether to hide the provider from the login screen.")
                boolean hideOnLogin,
        @Schema(description = "Whether the provider is restricted to account linking.")
                boolean accountLinkingOnly,
        @Schema(description = "Whether provider email claims are trusted.") boolean trustEmail,
        @Schema(description = "Whether MFA is required after provider authentication.")
                boolean mfaRequired,
        @Schema(description = "Provider order on login screens.", example = "0") int guiOrder,
        @Schema(description = "Account Console visibility.", example = "always")
                String showInAccountConsole,
        @Schema(description = "User synchronization policy.", example = "import")
                String syncMode) {}
