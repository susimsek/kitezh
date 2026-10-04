package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminKeyDTO;
import io.github.susimsek.kitezh.service.admin.KeyManagementService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/keys")
@RequiredArgsConstructor
@Tag(name = "Admin - Keys", description = "Signing key administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminKeyController {

    private final KeyManagementService keyManagementService;

    @GetMapping
    @Operation(
            summary = "List signing keys",
            description = "Returns signing keys with optional identifier and active-state filters.")
    @ApiResponse(responseCode = "200", description = "Paged signing-key summaries returned.")
    Page<AdminKeyDTO> keys(
            @Parameter(
                            description = "Optional key ID or key identifier search text.",
                            example = "rsa")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(description = "Filter by active state.", example = "true")
                    @RequestParam(required = false)
                    Boolean active,
            @PageableDefault(
                            size = 20,
                            sort = "createdAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return keyManagementService.keys(q, active, pageable);
    }

    @PostMapping("/rotate")
    @Operation(
            summary = "Rotate signing key",
            description =
                    "Creates a new active signing key and keeps previous keys available for"
                            + " verification.")
    @ApiResponse(responseCode = "200", description = "New active signing-key summary returned.")
    AdminKeyDTO rotateKey() {
        return keyManagementService.rotateKey();
    }
}
