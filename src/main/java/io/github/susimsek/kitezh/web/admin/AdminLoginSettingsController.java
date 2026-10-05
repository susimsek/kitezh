package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsRequestDTO;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
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
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
@Tag(name = "Admin - Login settings", description = "Public login and account feature switches.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminLoginSettingsController {

    private final LoginSettingsService loginSettingsService;

    @GetMapping("/login")
    @Operation(summary = "Get login settings")
    @ApiResponse(responseCode = "200", description = "Login settings returned.")
    AdminLoginSettingsDTO get() {
        return loginSettingsService.adminLoginSettings();
    }

    @PutMapping("/login")
    @Operation(summary = "Update login settings")
    @ApiResponse(responseCode = "200", description = "Login settings updated.")
    AdminLoginSettingsDTO update(@Valid @RequestBody AdminLoginSettingsRequestDTO request) {
        return loginSettingsService.update(request);
    }
}
