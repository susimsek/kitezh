package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminSocialProvider", description = "Social login provider credentials status.")
public record AdminSocialProviderDTO(
        @Schema(
                        description = "Provider registration id.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String provider,
        @Schema(
                        description = "Unique provider alias used by callback and login links.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @Schema(description = "Hide this provider from the public login page.") boolean hideOnLogin,
        @Schema(description = "Allow this provider only for linking existing accounts.")
                boolean accountLinkingOnly,
        @Schema(description = "Trust the provider's email claim as verified.") boolean trustEmail,
        @Schema(description = "Require TOTP MFA after this provider authenticates.")
                boolean mfaRequired,
        @Schema(
                        description =
                                "Comma-separated claims that must be present in the provider"
                                        + " response.",
                        example = "sub,email")
                String requiredClaims,
        @Schema(description = "Store access and refresh tokens issued by this provider.")
                boolean storeTokens,
        @Schema(description = "Allow the linked account to read the stored access token.")
                boolean storedTokensReadable,
        @Schema(description = "Provider order on the login page.", minimum = "0") int guiOrder,
        @Schema(
                        description = "Provider visibility in the Account Console.",
                        allowableValues = {"always", "when-linked", "never"})
                String showInAccountConsole,
        @Schema(
                        description = "OAuth client id.",
                        example = "client-id",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @Schema(
                        description = "Whether a client secret is configured.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean clientSecretConfigured) {}
