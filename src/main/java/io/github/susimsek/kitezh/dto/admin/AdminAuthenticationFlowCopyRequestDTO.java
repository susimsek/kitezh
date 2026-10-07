package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminAuthenticationFlowCopyRequest",
        description = "Copy an application authentication flow.")
public record AdminAuthenticationFlowCopyRequestDTO(
        @NotBlank
                @Size(max = 100)
                @Pattern(regexp = "[a-z0-9][a-z0-9._-]*")
                @Schema(
                        description = "Unique alias for the copied flow.",
                        example = "browser-copy",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @NotBlank
                @Size(max = 200)
                @Schema(
                        description = "Display name for the copied flow.",
                        example = "Browser copy",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Size(max = 1000)
                @Schema(description = "Optional description for the copied flow.", nullable = true)
                String description) {}
