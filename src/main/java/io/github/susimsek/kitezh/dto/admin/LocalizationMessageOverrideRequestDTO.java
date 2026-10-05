package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "LocalizationMessageOverrideRequest",
        description = "A locale-specific message override to save.")
public record LocalizationMessageOverrideRequestDTO(
        @NotBlank
                @Size(max = 10)
                @Pattern(regexp = "[a-zA-Z]{2,10}")
                @Schema(
                        description = "Locale tag.",
                        example = "tr",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String locale,
        @NotBlank
                @Size(max = 50)
                @Pattern(regexp = "[A-Za-z0-9_-]+")
                @Schema(
                        description = "Message bundle namespace.",
                        example = "admin",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String bundle,
        @NotBlank
                @Size(max = 255)
                @Pattern(regexp = "[A-Za-z0-9_.-]+")
                @Schema(
                        description = "Message bundle key.",
                        example = "login.title",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String messageKey,
        @NotBlank
                @Size(max = 4000)
                @Schema(
                        description = "Localized message value.",
                        example = "Oturum aç",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String messageValue) {}
