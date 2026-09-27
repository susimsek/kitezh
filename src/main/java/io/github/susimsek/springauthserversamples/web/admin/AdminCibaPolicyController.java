package io.github.susimsek.springauthserversamples.web.admin;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.dto.admin.AdminCibaPolicyDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminCibaPolicyRequestDTO;
import io.github.susimsek.springauthserversamples.service.admin.CibaPolicyService;
import io.github.susimsek.springauthserversamples.web.ApiController;
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

@RestController
@ApiController
@RequestMapping("/api/admin/settings/ciba-policy")
@RequiredArgsConstructor
@Tag(
        name = "Admin - CIBA policy",
        description = "Client-Initiated Backchannel Authentication policy.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminCibaPolicyController {

    private final CibaPolicyService cibaPolicyService;

    @GetMapping
    @Operation(summary = "Get CIBA policy")
    @ApiResponse(responseCode = "200", description = "CIBA policy returned.")
    AdminCibaPolicyDTO get() {
        return cibaPolicyService.get();
    }

    @PutMapping
    @Operation(summary = "Update CIBA policy")
    @ApiResponse(
            responseCode = "200",
            description = "CIBA policy updated.",
            content = @Content(schema = @Schema(implementation = AdminCibaPolicyDTO.class)))
    @ApiResponse(responseCode = "400", description = "The CIBA policy is invalid.")
    AdminCibaPolicyDTO update(@Valid @RequestBody AdminCibaPolicyRequestDTO request) {
        return cibaPolicyService.update(request);
    }
}
