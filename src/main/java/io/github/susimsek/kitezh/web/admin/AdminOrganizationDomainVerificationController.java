package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainVerificationDTO;
import io.github.susimsek.kitezh.service.admin.OrganizationDomainVerificationService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/organizations/{organizationId}/domains/{domainId}/verification")
@RequiredArgsConstructor
@Tag(name = "Admin - Organization domain verification")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationDomainVerificationController {

    private final OrganizationDomainVerificationService verificationService;

    @PostMapping
    @Operation(summary = "Start organization domain verification")
    AdminOrganizationDomainVerificationDTO start(
            @PathVariable Long organizationId, @PathVariable Long domainId) {
        return verificationService.start(organizationId, domainId);
    }
}
