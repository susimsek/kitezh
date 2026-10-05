package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminDashboardDTO;
import io.github.susimsek.kitezh.dto.admin.AdminServerInfoDTO;
import io.github.susimsek.kitezh.service.admin.AdminDashboardService;
import io.github.susimsek.kitezh.service.admin.AdminServerInfoService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin - Dashboard", description = "Administration dashboard and server metadata.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;
    private final AdminServerInfoService adminServerInfoService;

    @GetMapping("/dashboard")
    @Operation(
            summary = "Get administration dashboard",
            description = "Returns aggregate resource counts for the administration console.")
    @ApiResponse(responseCode = "200", description = "Dashboard counts returned.")
    AdminDashboardDTO dashboard() {
        return adminDashboardService.dashboard();
    }

    @GetMapping("/server-info")
    @Operation(
            summary = "Get server information",
            description =
                    "Returns configured OAuth2/OIDC endpoints and active signing-key metadata.")
    @ApiResponse(responseCode = "200", description = "Server metadata returned.")
    AdminServerInfoDTO serverInfo() {
        return adminServerInfoService.serverInfo();
    }
}
