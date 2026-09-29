package io.github.susimsek.springauthserversamples.web.admin;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeRoleMappingDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientScopeRoleMappingRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDTO;
import io.github.susimsek.springauthserversamples.service.admin.AdminClientScopeMapperService;
import io.github.susimsek.springauthserversamples.service.admin.AdminClientScopeRoleMappingService;
import io.github.susimsek.springauthserversamples.service.admin.AdminClientScopeService;
import io.github.susimsek.springauthserversamples.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.beans.factory.annotation.Autowired;
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
@RequestMapping("/api/admin/client-scopes")
@Tag(
        name = "Admin - Client Scopes",
        description = "Keycloak-style client scope catalogue management.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminClientScopeController {

    private final AdminClientScopeService adminClientScopeService;
    private final AdminClientScopeMapperService adminClientScopeMapperService;
    private final AdminClientScopeRoleMappingService adminClientScopeRoleMappingService;

    @Autowired
    public AdminClientScopeController(
            AdminClientScopeService adminClientScopeService,
            AdminClientScopeMapperService adminClientScopeMapperService,
            AdminClientScopeRoleMappingService adminClientScopeRoleMappingService) {
        this.adminClientScopeService = adminClientScopeService;
        this.adminClientScopeMapperService = adminClientScopeMapperService;
        this.adminClientScopeRoleMappingService = adminClientScopeRoleMappingService;
    }

    public AdminClientScopeController(AdminClientScopeService adminClientScopeService) {
        this(adminClientScopeService, null, null);
    }

    @GetMapping
    @Operation(
            summary = "Search client scopes",
            description = "Returns a paged client-scope list. `size` is capped at 100.")
    @ApiResponse(responseCode = "200", description = "Paged client scopes returned.")
    Page<AdminClientScopeDTO> findAll(
            @Parameter(
                            description = "Optional scope name or display-name search text.",
                            example = "account")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminClientScopeService.findAll(q, pageable);
    }

    @GetMapping("/{id}")
    @Operation(
            summary = "Get client scope",
            description = "Returns a single client scope from the scope catalogue.")
    @ApiResponse(responseCode = "200", description = "Client scope returned.")
    AdminClientScopeDTO findOne(
            @Parameter(
                            description = "Internal scope identifier.",
                            example = "scope-123",
                            required = true)
                    @PathVariable
                    String id) {
        return adminClientScopeService.findOne(id);
    }

    @PostMapping
    @Operation(
            summary = "Create client scope",
            description = "Creates a client scope in the scope catalogue.")
    @ApiResponse(responseCode = "201", description = "Client scope created and returned.")
    ResponseEntity<AdminClientScopeDTO> create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Client scope definition.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminClientScopeRequestDTO request) {
        var created = adminClientScopeService.create(request);
        return ResponseEntity.created(URI.create("/api/admin/client-scopes/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Update client scope",
            description = "Updates a client scope in the scope catalogue.")
    @ApiResponse(responseCode = "200", description = "Updated client scope returned.")
    AdminClientScopeDTO update(
            @Parameter(
                            description = "Internal scope identifier.",
                            example = "scope-123",
                            required = true)
                    @PathVariable
                    String id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Replacement client scope definition.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminClientScopeRequestDTO request) {
        return adminClientScopeService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete client scope",
            description = "Deletes a client scope that is no longer assigned to clients.")
    @ApiResponse(responseCode = "204", description = "Client scope deleted.")
    ResponseEntity<Void> delete(
            @Parameter(
                            description = "Internal scope identifier.",
                            example = "scope-123",
                            required = true)
                    @PathVariable
                    String id) {
        adminClientScopeService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/mappers")
    @Operation(
            summary = "List client scope protocol mappers",
            description = "Returns protocol mappers inherited by clients assigned this scope.")
    @ApiResponse(responseCode = "200", description = "Paged protocol mappers returned.")
    Page<AdminClientMapperDTO> mappers(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminClientScopeMapperService.findAll(id, q, pageable);
    }

    @PostMapping("/{id}/mappers")
    @Operation(
            summary = "Create a client scope protocol mapper",
            description = "Creates a protocol mapper owned by the client scope.")
    @ApiResponse(responseCode = "201", description = "Protocol mapper created.")
    ResponseEntity<AdminClientMapperDTO> createMapper(
            @PathVariable String id, @Valid @RequestBody AdminClientMapperRequestDTO request) {
        AdminClientMapperDTO created = adminClientScopeMapperService.create(id, request);
        return ResponseEntity.created(
                        URI.create("/api/admin/client-scopes/" + id + "/mappers/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}/mappers/{mapperId}")
    @Operation(
            summary = "Update a client scope protocol mapper",
            description = "Updates a protocol mapper owned by the client scope.")
    @ApiResponse(responseCode = "200", description = "Protocol mapper updated.")
    AdminClientMapperDTO updateMapper(
            @PathVariable String id,
            @PathVariable Long mapperId,
            @Valid @RequestBody AdminClientMapperRequestDTO request) {
        return adminClientScopeMapperService.update(id, mapperId, request);
    }

    @DeleteMapping("/{id}/mappers/{mapperId}")
    @Operation(
            summary = "Delete a client scope protocol mapper",
            description = "Deletes a protocol mapper owned by the client scope.")
    @ApiResponse(responseCode = "204", description = "Protocol mapper deleted.")
    ResponseEntity<Void> deleteMapper(@PathVariable String id, @PathVariable Long mapperId) {
        adminClientScopeMapperService.delete(id, mapperId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/role-mappings")
    @Operation(
            summary = "Get client scope role mappings",
            description = "Returns the application and client roles exposed by this scope.")
    @ApiResponse(responseCode = "200", description = "Role mappings returned.")
    AdminClientScopeRoleMappingDTO roleMappings(@PathVariable String id) {
        return adminClientScopeRoleMappingService.find(id);
    }

    @PutMapping("/{id}/role-mappings")
    @Operation(
            summary = "Replace client scope role mappings",
            description = "Replaces the complete application and client-role mapping set.")
    @ApiResponse(responseCode = "200", description = "Role mappings updated.")
    AdminClientScopeRoleMappingDTO updateRoleMappings(
            @PathVariable String id,
            @Valid @RequestBody AdminClientScopeRoleMappingRequestDTO request) {
        return adminClientScopeRoleMappingService.update(id, request);
    }

    @GetMapping("/{id}/role-mappings/application-roles")
    @Operation(
            summary = "Search application roles for a client scope",
            description = "Returns bounded application-role candidates.")
    @ApiResponse(responseCode = "200", description = "Paged application roles returned.")
    Page<AdminRoleDTO> applicationRoleCandidates(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminClientScopeRoleMappingService.applicationRoleCandidates(id, q, pageable);
    }

    @GetMapping("/{id}/role-mappings/client-roles")
    @Operation(
            summary = "Search client roles for a client scope",
            description = "Returns bounded client-role candidates across the single issuer.")
    @ApiResponse(responseCode = "200", description = "Paged client roles returned.")
    Page<AdminClientRoleDTO> clientRoleCandidates(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminClientScopeRoleMappingService.clientRoleCandidates(id, q, pageable);
    }
}
