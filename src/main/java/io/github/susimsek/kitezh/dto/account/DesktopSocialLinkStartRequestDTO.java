package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Native desktop social-link transaction request.")
public record DesktopSocialLinkStartRequestDTO(
        @Schema(
                        description = "Native callback correlation value.",
                        example = "native-state-value",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(min = 16, max = 256)
                String state,
        @Schema(
                        description = "Base64url-encoded PKCE S256 challenge.",
                        example = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
                        format = "byte",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(min = 43, max = 128)
                @Pattern(regexp = "[A-Za-z0-9_-]+")
                String codeChallenge) {}
