package io.github.susimsek.kitezh.dto.localization;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "UserLocaleRequest", description = "The authenticated user's locale preference.")
public record UserLocaleRequestDTO(
        @Schema(
                        description = "BCP 47 language tag.",
                        example = "tr",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 10)
                String locale) {}
