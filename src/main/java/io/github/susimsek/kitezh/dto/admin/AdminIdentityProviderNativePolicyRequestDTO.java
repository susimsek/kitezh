package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminIdentityProviderNativePolicyRequest",
        description = "Bounded native-safe policy update; excludes credentials and endpoints.")
public record AdminIdentityProviderNativePolicyRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Schema(description = "Provider display name.", example = "Acme SSO")
                String displayName,
        @Schema(description = "Whether the provider accepts new logins.") boolean enabled,
        @Schema(description = "Whether to hide the provider from the login screen.")
                boolean hideOnLogin,
        @Schema(description = "Whether the provider is restricted to account linking.")
                boolean accountLinkingOnly,
        @Schema(description = "Whether provider email claims are trusted.") boolean trustEmail,
        @Schema(description = "Whether MFA is required after provider authentication.")
                boolean mfaRequired,
        @Min(value = 0, message = "{app.api.problem.violation.min}")
                @Schema(description = "Provider order on login screens.", example = "0")
                int guiOrder,
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Pattern(regexp = "(?i)always|when-linked|never")
                @Schema(description = "Account Console visibility.", example = "always")
                String showInAccountConsole,
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Pattern(regexp = "(?i)legacy|import|read[_-]only|force")
                @Schema(description = "User synchronization policy.", example = "import")
                String syncMode) {}
