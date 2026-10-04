package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminBrandingSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminBrandingSettingsRequestDTO;
import io.github.susimsek.kitezh.service.BrandingSettingsService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/admin/settings/branding")
@RequiredArgsConstructor
@Tag(name = "Admin - Branding", description = "Application branding settings.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminBrandingSettingsController {

    private final BrandingSettingsService brandingSettingsService;

    @GetMapping
    @Operation(summary = "Get branding settings")
    @ApiResponse(
            responseCode = "200",
            description = "Branding settings returned.",
            content = @Content(schema = @Schema(implementation = AdminBrandingSettingsDTO.class)))
    AdminBrandingSettingsDTO get() {
        return brandingSettingsService.adminSettings();
    }

    @PutMapping
    @Operation(summary = "Update branding settings")
    @ApiResponse(
            responseCode = "200",
            description = "Branding settings updated.",
            content = @Content(schema = @Schema(implementation = AdminBrandingSettingsDTO.class)))
    AdminBrandingSettingsDTO update(@Valid @RequestBody AdminBrandingSettingsRequestDTO request) {
        return brandingSettingsService.update(request);
    }
}
