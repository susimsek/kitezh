package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPolicyDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPolicyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminAuthorizationServicesService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
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

@RestController
@ApiController
@RequestMapping("/api/admin/authorization")
@Tag(
        name = "Admin - Authorization Services",
        description = "Manage protected resources, scopes, policies, and permissions.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminAuthorizationServicesController {

    private final AdminAuthorizationServicesService authorizationServicesService;

    public AdminAuthorizationServicesController(
            AdminAuthorizationServicesService authorizationServicesService) {
        this.authorizationServicesService = authorizationServicesService;
    }

    @GetMapping("/resources")
    @Operation(summary = "Search protected resources")
    @ApiResponse(responseCode = "200", description = "Paged protected resources returned.")
    Page<AdminAuthorizationResourceDTO> resources(
            @Parameter(description = "Optional resource-name search.", example = "orders")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return authorizationServicesService.resources(q, pageable);
    }

    @GetMapping("/resources/{id}")
    @Operation(summary = "Get a protected resource")
    @ApiResponse(responseCode = "200", description = "Protected resource returned.")
    AdminAuthorizationResourceDTO resource(@PathVariable String id) {
        return authorizationServicesService.resource(id);
    }

    @PostMapping("/resources")
    @Operation(summary = "Create a protected resource")
    @ApiResponse(responseCode = "201", description = "Protected resource created.")
    ResponseEntity<AdminAuthorizationResourceDTO> createResource(
            @Valid @RequestBody AdminAuthorizationResourceRequestDTO request) {
        AdminAuthorizationResourceDTO created =
                authorizationServicesService.createResource(request);
        return ResponseEntity.created(
                        URI.create("/api/admin/authorization/resources/" + created.id()))
                .body(created);
    }

    @PutMapping("/resources/{id}")
    @Operation(summary = "Update a protected resource and its scopes")
    @ApiResponse(responseCode = "200", description = "Protected resource updated.")
    AdminAuthorizationResourceDTO updateResource(
            @PathVariable String id,
            @Valid @RequestBody AdminAuthorizationResourceRequestDTO request) {
        return authorizationServicesService.updateResource(id, request);
    }

    @DeleteMapping("/resources/{id}")
    @Operation(summary = "Delete a protected resource")
    @ApiResponse(responseCode = "204", description = "Protected resource deleted.")
    ResponseEntity<Void> deleteResource(@PathVariable String id) {
        authorizationServicesService.deleteResource(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/policies")
    @Operation(summary = "Search authorization policies")
    @ApiResponse(responseCode = "200", description = "Paged authorization policies returned.")
    Page<AdminAuthorizationPolicyDTO> policies(
            @Parameter(description = "Optional policy-name search.", example = "owner")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return authorizationServicesService.policies(q, pageable);
    }

    @PostMapping("/policies")
    @Operation(summary = "Create an authorization policy")
    @ApiResponse(responseCode = "201", description = "Authorization policy created.")
    ResponseEntity<AdminAuthorizationPolicyDTO> createPolicy(
            @Valid @RequestBody AdminAuthorizationPolicyRequestDTO request) {
        AdminAuthorizationPolicyDTO created = authorizationServicesService.createPolicy(request);
        return ResponseEntity.created(
                        URI.create("/api/admin/authorization/policies/" + created.id()))
                .body(created);
    }

    @PutMapping("/policies/{id}")
    @Operation(summary = "Update an authorization policy")
    @ApiResponse(responseCode = "200", description = "Authorization policy updated.")
    AdminAuthorizationPolicyDTO updatePolicy(
            @PathVariable String id,
            @Valid @RequestBody AdminAuthorizationPolicyRequestDTO request) {
        return authorizationServicesService.updatePolicy(id, request);
    }

    @DeleteMapping("/policies/{id}")
    @Operation(summary = "Delete an authorization policy")
    @ApiResponse(responseCode = "204", description = "Authorization policy deleted.")
    ResponseEntity<Void> deletePolicy(@PathVariable String id) {
        authorizationServicesService.deletePolicy(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/permissions")
    @Operation(summary = "List authorization permissions")
    @ApiResponse(responseCode = "200", description = "Paged authorization permissions returned.")
    Page<AdminAuthorizationPermissionDTO> permissions(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return authorizationServicesService.permissions(pageable);
    }

    @PostMapping("/permissions")
    @Operation(summary = "Create a resource permission")
    @ApiResponse(responseCode = "201", description = "Resource permission created.")
    ResponseEntity<AdminAuthorizationPermissionDTO> createPermission(
            @Valid @RequestBody AdminAuthorizationPermissionRequestDTO request) {
        AdminAuthorizationPermissionDTO created =
                authorizationServicesService.createPermission(request);
        return ResponseEntity.created(
                        URI.create("/api/admin/authorization/permissions/" + created.id()))
                .body(created);
    }

    @PutMapping("/permissions/{id}")
    @Operation(summary = "Update a resource permission")
    @ApiResponse(responseCode = "200", description = "Resource permission updated.")
    AdminAuthorizationPermissionDTO updatePermission(
            @PathVariable String id,
            @Valid @RequestBody AdminAuthorizationPermissionRequestDTO request) {
        return authorizationServicesService.updatePermission(id, request);
    }

    @DeleteMapping("/permissions/{id}")
    @Operation(summary = "Delete a resource permission")
    @ApiResponse(responseCode = "204", description = "Resource permission deleted.")
    ResponseEntity<Void> deletePermission(@PathVariable String id) {
        authorizationServicesService.deletePermission(id);
        return ResponseEntity.noContent().build();
    }
}
