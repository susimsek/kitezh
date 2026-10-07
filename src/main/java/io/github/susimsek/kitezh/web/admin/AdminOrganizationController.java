package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/organizations")
@RequiredArgsConstructor
@Tag(name = "Admin - Organizations", description = "Organizations within the single issuer.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationController {

    private final AdminOrganizationService adminOrganizationService;

    @GetMapping
    @Operation(summary = "Search organizations", description = "Returns a paged organization list.")
    @ApiResponse(responseCode = "200", description = "Paged organizations returned.")
    Page<AdminOrganizationDTO> findAll(
            @Parameter(description = "Optional alias or name search text.", example = "acme")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "alias") Pageable pageable) {
        return adminOrganizationService.findAll(q, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get organization", description = "Returns one organization by id.")
    @ApiResponse(responseCode = "200", description = "Organization returned.")
    AdminOrganizationDTO findById(@PathVariable Long id) {
        return adminOrganizationService.findById(id);
    }

    @PostMapping
    @Operation(summary = "Create organization", description = "Creates an organization.")
    @ApiResponse(responseCode = "201", description = "Organization created and returned.")
    ResponseEntity<AdminOrganizationDTO> create(
            @Valid @RequestBody AdminOrganizationRequestDTO request) {
        AdminOrganizationDTO created = adminOrganizationService.create(request);
        return ResponseEntity.created(URI.create("/api/admin/organizations/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Update organization",
            description = "Updates an organization; its alias is immutable.")
    @ApiResponse(responseCode = "200", description = "Organization updated and returned.")
    AdminOrganizationDTO update(
            @PathVariable Long id, @Valid @RequestBody AdminOrganizationRequestDTO request) {
        return adminOrganizationService.update(id, request);
    }
}
