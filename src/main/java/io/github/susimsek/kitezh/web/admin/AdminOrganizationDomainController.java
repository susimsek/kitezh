package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationDomainService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/organizations/{organizationId}/domains")
@RequiredArgsConstructor
@Tag(name = "Admin - Organization domains", description = "Organization domain management.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationDomainController {

    private final AdminOrganizationDomainService domainService;

    @GetMapping
    @Operation(summary = "List organization domains", description = "Returns a paged domain list.")
    @ApiResponse(responseCode = "200", description = "Paged domains returned.")
    Page<AdminOrganizationDomainDTO> findAll(
            @PathVariable Long organizationId,
            @PageableDefault(size = 20, sort = "domain") Pageable pageable) {
        return domainService.findAll(organizationId, pageable);
    }

    @PostMapping
    @Operation(
            summary = "Add organization domain",
            description = "Associates a unique domain with an organization.")
    @ApiResponse(responseCode = "201", description = "Domain added.")
    ResponseEntity<AdminOrganizationDomainDTO> add(
            @PathVariable Long organizationId,
            @Valid @RequestBody AdminOrganizationDomainRequestDTO request) {
        AdminOrganizationDomainDTO domain = domainService.add(organizationId, request);
        return ResponseEntity.created(
                        URI.create(
                                "/api/admin/organizations/"
                                        + organizationId
                                        + "/domains/"
                                        + domain.id()))
                .body(domain);
    }

    @DeleteMapping("/{domainId}")
    @Operation(
            summary = "Remove organization domain",
            description = "Removes a domain association.")
    @ApiResponse(responseCode = "204", description = "Domain removed.")
    ResponseEntity<Void> remove(@PathVariable Long organizationId, @PathVariable Long domainId) {
        domainService.remove(organizationId, domainId);
        return ResponseEntity.noContent().build();
    }
}
