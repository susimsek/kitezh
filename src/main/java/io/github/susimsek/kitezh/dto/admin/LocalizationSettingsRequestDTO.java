package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(
        name = "LocalizationSettingsRequest",
        description = "Updated application localization settings.")
public record LocalizationSettingsRequestDTO(
        @Schema(
                        description = "Whether localization is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean internationalizationEnabled,
        @NotBlank
                @Size(max = 10)
                @Schema(
                        description = "Default locale.",
                        example = "en",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String defaultLocale,
        @NotEmpty
                @Size(max = 10)
                @Schema(
                        description = "Enabled locales.",
                        example = "[\"en\",\"tr\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<@NotBlank @Size(max = 10) String> supportedLocales) {}
