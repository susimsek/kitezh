package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationPermissionRequestDTO;
import io.github.susimsek.kitezh.service.admin.OrganizationPermissionService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/organizations/{organizationId}/permissions")
@RequiredArgsConstructor
@Tag(name = "Admin - Organization permissions")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationPermissionController {

    private final OrganizationPermissionService permissionService;

    @GetMapping
    @Operation(summary = "List organization permissions")
    Page<AdminOrganizationPermissionDTO> findAll(
            @PathVariable Long organizationId,
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return permissionService.findAll(organizationId, pageable);
    }

    @PutMapping
    @Operation(summary = "Grant or update an organization permission")
    AdminOrganizationPermissionDTO upsert(
            @PathVariable Long organizationId,
            @Valid @RequestBody AdminOrganizationPermissionRequestDTO request) {
        return permissionService.upsert(organizationId, request);
    }
}
