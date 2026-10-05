package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "ActionTokenRequest", description = "Single-use account action token request.")
public record ActionTokenRequestDTO(
        @Schema(
                        description = "Single-use token received by email.",
                        example = "eyJhbGciOiJIUzI1NiJ9.action-token",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String token) {}
