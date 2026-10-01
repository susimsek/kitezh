package io.github.susimsek.springauthserversamples.web.admin;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.dto.admin.AdminOfflineAccessPolicyDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminOfflineAccessPolicyRequestDTO;
import io.github.susimsek.springauthserversamples.service.admin.OfflineAccessPolicyService;
import io.github.susimsek.springauthserversamples.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/settings/offline-access")
@RequiredArgsConstructor
@Tag(name = "Admin - Offline access", description = "Offline access session policy administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminOfflineAccessPolicyController {

    private final OfflineAccessPolicyService service;

    @GetMapping
    @Operation(summary = "Get offline access policy")
    @ApiResponse(responseCode = "200", description = "Offline access policy returned.")
    AdminOfflineAccessPolicyDTO get() {
        return service.get();
    }

    @PutMapping
    @Operation(summary = "Update offline access policy")
    @ApiResponse(responseCode = "200", description = "Offline access policy updated.")
    AdminOfflineAccessPolicyDTO update(
            @Valid @RequestBody AdminOfflineAccessPolicyRequestDTO request) {
        return service.update(request);
    }

    @PostMapping("/revoke-all")
    @Operation(summary = "Revoke all offline access tokens")
    @ApiResponse(responseCode = "200", description = "Offline access tokens revoked.")
    ResponseEntity<AdminOfflineAccessPolicyDTO> revokeAll() {
        return ResponseEntity.ok(service.revokeAll());
    }
}
