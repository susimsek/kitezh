package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminSocialProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSocialProvidersRequestDTO;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/admin/settings/social-providers")
@RequiredArgsConstructor
@Tag(name = "Admin - Social providers", description = "OAuth social provider credentials.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminSocialProviderController {

    private final SocialProviderSettingsService socialProviderSettingsService;

    @GetMapping
    @Operation(summary = "Get social provider settings")
    @ApiResponse(responseCode = "200", description = "Social provider settings returned.")
    List<AdminSocialProviderDTO> get() {
        return socialProviderSettingsService.adminSettings();
    }

    @PutMapping
    @Operation(summary = "Update social provider settings")
    @ApiResponse(responseCode = "200", description = "Social provider settings updated.")
    List<AdminSocialProviderDTO> update(
            @Valid @RequestBody AdminSocialProvidersRequestDTO request) {
        return socialProviderSettingsService.update(request);
    }
}
