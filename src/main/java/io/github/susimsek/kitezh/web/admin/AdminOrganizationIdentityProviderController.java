package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationIdentityProviderService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/organizations/{organizationId}/identity-providers")
@RequiredArgsConstructor
@Tag(
        name = "Admin - Organization identity providers",
        description = "Organization identity-provider bindings.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationIdentityProviderController {

    private final AdminOrganizationIdentityProviderService identityProviderService;

    @GetMapping
    @Operation(summary = "List organization identity providers")
    Page<AdminOrganizationIdentityProviderDTO> findAll(
            @PathVariable Long organizationId,
            @PageableDefault(size = 20, sort = "providerAlias") Pageable pageable) {
        return identityProviderService.findAll(organizationId, pageable);
    }

    @PostMapping
    @Operation(summary = "Bind an identity provider to an organization")
    ResponseEntity<AdminOrganizationIdentityProviderDTO> add(
            @PathVariable Long organizationId,
            @Valid @RequestBody AdminOrganizationIdentityProviderRequestDTO request) {
        AdminOrganizationIdentityProviderDTO binding =
                identityProviderService.add(organizationId, request);
        return ResponseEntity.created(
                        URI.create(
                                "/api/admin/organizations/"
                                        + organizationId
                                        + "/identity-providers/"
                                        + binding.id()))
                .body(binding);
    }

    @PutMapping("/{bindingId}")
    @Operation(summary = "Update an organization identity-provider binding")
    AdminOrganizationIdentityProviderDTO update(
            @PathVariable Long organizationId,
            @PathVariable Long bindingId,
            @Valid @RequestBody AdminOrganizationIdentityProviderRequestDTO request) {
        return identityProviderService.update(organizationId, bindingId, request);
    }

    @DeleteMapping("/{bindingId}")
    @Operation(summary = "Remove an identity provider from an organization")
    ResponseEntity<Void> remove(@PathVariable Long organizationId, @PathVariable Long bindingId) {
        identityProviderService.remove(organizationId, bindingId);
        return ResponseEntity.noContent().build();
    }
}
