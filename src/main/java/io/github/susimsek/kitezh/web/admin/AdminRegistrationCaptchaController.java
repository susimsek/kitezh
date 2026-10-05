package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminRegistrationCaptchaDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRegistrationCaptchaRequestDTO;
import io.github.susimsek.kitezh.service.security.RegistrationCaptchaSettingsService;
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
@Tag(name = "Admin - Registration CAPTCHA", description = "Registration bot protection settings.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminRegistrationCaptchaController {

    private final RegistrationCaptchaSettingsService settingsService;

    @GetMapping("/registration-captcha")
    @Operation(summary = "Get registration CAPTCHA settings")
    @ApiResponse(responseCode = "200", description = "Registration CAPTCHA settings returned.")
    AdminRegistrationCaptchaDTO get() {
        return settingsService.adminSettings();
    }

    @PutMapping("/registration-captcha")
    @Operation(summary = "Update registration CAPTCHA settings")
    @ApiResponse(responseCode = "200", description = "Registration CAPTCHA settings updated.")
    AdminRegistrationCaptchaDTO update(
            @Valid @RequestBody AdminRegistrationCaptchaRequestDTO request) {
        return settingsService.update(request);
    }
}
