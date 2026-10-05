package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsRequestDTO;
import io.github.susimsek.kitezh.service.EmailConnectionTestService;
import io.github.susimsek.kitezh.service.EmailSettingsService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/admin/settings/email")
@RequiredArgsConstructor
@Tag(name = "Admin - Email settings", description = "SMTP configuration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminEmailSettingsController {
    private final EmailSettingsService service;
    private final EmailConnectionTestService connectionTestService;

    @GetMapping
    @Operation(
            summary = "Get email settings",
            description = "Returns the SMTP configuration without exposing the stored password.")
    @ApiResponse(responseCode = "200", description = "Email settings returned.")
    AdminEmailSettingsDTO get() {
        return service.get();
    }

    @PutMapping
    @Operation(
            summary = "Update email settings",
            description =
                    "Updates SMTP delivery settings; a blank password retains the existing secret.")
    @ApiResponse(responseCode = "200", description = "Email settings updated.")
    AdminEmailSettingsDTO update(@Valid @RequestBody AdminEmailSettingsRequestDTO request) {
        return service.update(request);
    }

    @PostMapping("/test")
    @Operation(
            summary = "Test email connection",
            description =
                    "Sends a test email to the authenticated administrator using the submitted"
                            + " SMTP settings without saving them.")
    @ApiResponse(responseCode = "204", description = "SMTP connection test email sent.")
    @ApiResponse(responseCode = "400", description = "The request or SMTP connection is invalid.")
    ResponseEntity<Void> testConnection(
            @Valid @RequestBody AdminEmailSettingsRequestDTO request,
            Authentication authentication,
            Locale locale) {
        connectionTestService.test(request, authentication.getName(), locale);
        return ResponseEntity.noContent().build();
    }
}
