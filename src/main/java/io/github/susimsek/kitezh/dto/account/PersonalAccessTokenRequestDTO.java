package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

@Schema(name = "PersonalAccessTokenRequest", description = "Personal MCP access token settings.")
public record PersonalAccessTokenRequestDTO(
        @Schema(
                        description = "A label to identify this token.",
                        example = "Codex on laptop",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String name,
        @Schema(
                        description = "Optional description to help identify this token.",
                        example = "Connect Codex on my laptop",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 500)
                String description,
        @Schema(
                        description =
                                "Token expiration selection: 7, 30, 60, 90, custom, or never.",
                        example = "30",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "7|30|60|90|custom|never")
                String expiration,
        @Schema(
                        description =
                                "Expiration date in UTC calendar format, required only for custom"
                                        + " expiration.",
                        example = "2026-12-31",
                        format = "date",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                LocalDate customExpirationDate) {}
