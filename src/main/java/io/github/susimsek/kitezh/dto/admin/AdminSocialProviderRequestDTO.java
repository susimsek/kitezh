package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminSocialProviderRequest",
        description = "Social login provider credentials update.")
public record AdminSocialProviderRequestDTO(
        @Schema(
                        description = "Provider registration id.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                String provider,
        @Schema(
                        description = "Unique provider alias used by callback and login links.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @jakarta.validation.constraints.Pattern(regexp = "[a-z0-9][a-z0-9_-]{0,49}")
                String alias,
        @Schema(
                        description = "OAuth client id.",
                        example = "client-id",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                @Size(max = 500)
                String clientId,
        @Schema(
                        description =
                                "New OAuth client secret. Leave blank to keep the existing secret.",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                @Size(max = 1000)
                String clientSecret,
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
                @Size(max = 500)
                String requiredClaims,
        @Schema(description = "Store access and refresh tokens issued by this provider.")
                boolean storeTokens,
        @Schema(description = "Allow the linked account to read the stored access token.")
                boolean storedTokensReadable,
        @Schema(description = "Provider order on the login page.", minimum = "0")
                @jakarta.validation.constraints.Min(0)
                int guiOrder,
        @Schema(
                        description = "Provider visibility in the Account Console.",
                        allowableValues = {"always", "when-linked", "never"})
                @NotBlank
                @jakarta.validation.constraints.Pattern(regexp = "(?i)always|when-linked|never")
                String showInAccountConsole) {}
