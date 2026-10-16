package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Native desktop social-link callback completion request.")
public record DesktopSocialLinkCompleteRequestDTO(
        @Schema(
                        description =
                                "Opaque, single-use completion code from the native callback.",
                        example = "opaque-completion-code",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(min = 32, max = 128)
                @Pattern(regexp = "[A-Za-z0-9_-]+")
                String code,
        @Schema(
                        description = "PKCE verifier retained by the native main process.",
                        example = "native-pkce-verifier",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(min = 43, max = 128)
                @Pattern(regexp = "[A-Za-z0-9_-]+")
                String codeVerifier) {}
