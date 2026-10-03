package io.github.susimsek.springauthserversamples.web.admin;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.dto.admin.AdminSearchResponseDTO;
import io.github.susimsek.springauthserversamples.service.admin.AdminGlobalSearchService;
import io.github.susimsek.springauthserversamples.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/search")
@RequiredArgsConstructor
@Tag(name = "Admin - Search", description = "Permission-filtered global administration search.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminGlobalSearchController {

    private final AdminGlobalSearchService adminGlobalSearchService;

    @GetMapping
    @Operation(
            summary = "Search administration resources",
            description =
                    "Returns up to five matching users, clients, roles, and groups per resource"
                        + " type. Results are filtered by the caller's administration authorities.")
    @ApiResponse(responseCode = "200", description = "Search results returned.")
    AdminSearchResponseDTO search(
            @Parameter(
                            description = "Search text, between 1 and 100 characters.",
                            example = "admin")
                    @RequestParam(defaultValue = "")
                    String q,
            Authentication authentication) {
        return adminGlobalSearchService.search(q, authentication);
    }
}
