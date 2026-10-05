package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminProviderMapperDTO;
import io.github.susimsek.kitezh.dto.admin.AdminProviderMapperRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminIdentityProviderService;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/admin/identity-providers")
@RequiredArgsConstructor
@Tag(
        name = "Admin - Identity providers",
        description = "Keycloak-style identity provider and mapper management.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminIdentityProviderController {

    private final AdminIdentityProviderService service;

    @GetMapping
    @Operation(summary = "Search identity providers")
    @ApiResponse(responseCode = "200", description = "Paged identity providers returned.")
    Page<AdminIdentityProviderDTO> findAll(
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "guiOrder") Pageable pageable) {
        return service.findAll(q, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get identity provider")
    ResponseEntity<AdminIdentityProviderDTO> findById(@PathVariable String id) {
        AdminIdentityProviderDTO provider = service.findById(id);
        return provider == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(provider);
    }

    @PostMapping
    @Operation(summary = "Create identity provider")
    @ApiResponse(responseCode = "201", description = "Identity provider created.")
    ResponseEntity<AdminIdentityProviderDTO> create(
            @Valid @RequestBody AdminIdentityProviderRequestDTO request) {
        AdminIdentityProviderDTO result = service.create(request);
        return ResponseEntity.created(URI.create("/api/admin/identity-providers/" + result.id()))
                .body(result);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update identity provider")
    AdminIdentityProviderDTO update(
            @PathVariable String id, @Valid @RequestBody AdminIdentityProviderRequestDTO request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete identity provider")
    @ApiResponse(responseCode = "204", description = "Identity provider deleted.")
    ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/mappers")
    @Operation(summary = "Search provider mappers")
    Page<AdminProviderMapperDTO> findMappers(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return service.findMappers(id, q, pageable);
    }

    @PostMapping("/{id}/mappers")
    @Operation(summary = "Create provider mapper")
    AdminProviderMapperDTO createMapper(
            @PathVariable String id, @Valid @RequestBody AdminProviderMapperRequestDTO request) {
        return service.createMapper(id, request);
    }

    @PutMapping("/{id}/mappers/{mapperId}")
    @Operation(summary = "Update provider mapper")
    AdminProviderMapperDTO updateMapper(
            @PathVariable String id,
            @PathVariable String mapperId,
            @Valid @RequestBody AdminProviderMapperRequestDTO request) {
        return service.updateMapper(id, mapperId, request);
    }

    @DeleteMapping("/{id}/mappers/{mapperId}")
    @Operation(summary = "Delete provider mapper")
    ResponseEntity<Void> deleteMapper(@PathVariable String id, @PathVariable String mapperId) {
        service.deleteMapper(id, mapperId);
        return ResponseEntity.noContent().build();
    }
}
