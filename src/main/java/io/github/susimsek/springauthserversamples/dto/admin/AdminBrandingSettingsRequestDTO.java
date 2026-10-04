package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Updated application branding settings.")
public record AdminBrandingSettingsRequestDTO(
        @NotBlank
                @Size(max = 100)
                @Schema(
                        description = "Application name shown in public and console headers.",
                        example = "Kitezh",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String applicationName,
        @NotBlank
                @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
                @Schema(
                        description = "Primary brand color.",
                        example = "#0d6efd",
                        pattern = "^#[0-9A-Fa-f]{6}$",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String primaryColor,
        @NotBlank
                @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
                @Schema(
                        description = "Accent brand color.",
                        example = "#0b2b69",
                        pattern = "^#[0-9A-Fa-f]{6}$",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String accentColor,
        @NotBlank
                @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
                @Schema(
                        description = "Application background color.",
                        example = "#f8f9fa",
                        pattern = "^#[0-9A-Fa-f]{6}$",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String backgroundColor) {}
