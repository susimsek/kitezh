package io.github.susimsek.springauthserversamples.web.admin;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleDetailDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleGroupDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleUserDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleUserRequestDTO;
import io.github.susimsek.springauthserversamples.service.admin.AdminClientRoleService;
import io.github.susimsek.springauthserversamples.web.ApiController;
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
@RequestMapping("/api/admin/clients/{clientId}/roles")
@RequiredArgsConstructor
@Tag(name = "Admin - Client roles", description = "Client-scoped role administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminClientRoleController {

    private final AdminClientRoleService service;

    @GetMapping
    @Operation(summary = "Search client roles", description = "Returns roles owned by one client.")
    @ApiResponse(responseCode = "200", description = "Paged client roles returned.")
    Page<AdminClientRoleDTO> findAll(
            @PathVariable String clientId,
            @Parameter(description = "Optional role-name search text.", example = "invoice")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return service.findAll(clientId, q, pageable);
    }

    @PostMapping
    @Operation(
            summary = "Create client role",
            description = "Creates a role in the client namespace.")
    @ApiResponse(responseCode = "201", description = "Client role created.")
    ResponseEntity<AdminClientRoleDTO> create(
            @PathVariable String clientId, @Valid @RequestBody AdminClientRoleRequestDTO request) {
        AdminClientRoleDTO role = service.create(clientId, request);
        return ResponseEntity.created(
                        URI.create("/api/admin/clients/" + clientId + "/roles/" + role.id()))
                .body(role);
    }

    @GetMapping("/{roleId}")
    @Operation(summary = "Get client role", description = "Returns role details and user mappings.")
    @ApiResponse(responseCode = "200", description = "Client role returned.")
    AdminClientRoleDetailDTO findOne(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return service.findOne(clientId, roleId, q, pageable);
    }

    @PutMapping("/{roleId}")
    @Operation(
            summary = "Update client role",
            description = "Updates a client role description or name.")
    @ApiResponse(responseCode = "200", description = "Client role updated.")
    AdminClientRoleDTO update(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @Valid @RequestBody AdminClientRoleRequestDTO request) {
        return service.update(clientId, roleId, request);
    }

    @DeleteMapping("/{roleId}")
    @Operation(summary = "Delete client role", description = "Deletes an unassigned client role.")
    @ApiResponse(responseCode = "204", description = "Client role deleted.")
    ResponseEntity<Void> delete(@PathVariable String clientId, @PathVariable Long roleId) {
        service.delete(clientId, roleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{roleId}/users")
    @Operation(
            summary = "List client role users",
            description = "Returns users assigned to a client role.")
    @ApiResponse(responseCode = "200", description = "Paged assigned users returned.")
    Page<AdminRoleUserDTO> users(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return service.findOne(clientId, roleId, q, pageable).users();
    }

    @GetMapping("/{roleId}/available-users")
    @Operation(
            summary = "List available users",
            description = "Returns enabled users not assigned to the role.")
    @ApiResponse(responseCode = "200", description = "Paged available users returned.")
    Page<AdminRoleUserDTO> availableUsers(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 10, sort = "username") Pageable pageable) {
        return service.availableUsers(clientId, roleId, q, pageable);
    }

    @GetMapping("/{roleId}/available-groups")
    @Operation(
            summary = "List available groups",
            description = "Returns groups not assigned to the client role.")
    @ApiResponse(responseCode = "200", description = "Paged available groups returned.")
    Page<AdminClientRoleGroupDTO> availableGroups(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 10, sort = "name") Pageable pageable) {
        return service.availableGroups(clientId, roleId, q, pageable);
    }

    @PostMapping("/{roleId}/users")
    @Operation(
            summary = "Assign user to client role",
            description = "Assigns a user to the client role.")
    @ApiResponse(responseCode = "200", description = "Updated client role returned.")
    AdminClientRoleDetailDTO assignUser(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @Valid @RequestBody AdminRoleUserRequestDTO request,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return service.assignUser(clientId, roleId, request.userId(), pageable);
    }

    @DeleteMapping("/{roleId}/users/{userId}")
    @Operation(
            summary = "Remove user from client role",
            description = "Removes a user from the client role.")
    @ApiResponse(responseCode = "200", description = "Updated client role returned.")
    AdminClientRoleDetailDTO removeUser(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @PathVariable Long userId,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return service.removeUser(clientId, roleId, userId, pageable);
    }

    @PostMapping("/{roleId}/groups/{groupId}")
    @Operation(
            summary = "Assign group to client role",
            description = "Assigns a group and its members to the role.")
    @ApiResponse(responseCode = "200", description = "Updated client role returned.")
    AdminClientRoleDetailDTO assignGroup(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @PathVariable Long groupId,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return service.assignGroup(clientId, roleId, groupId, pageable);
    }

    @DeleteMapping("/{roleId}/groups/{groupId}")
    @Operation(
            summary = "Remove group from client role",
            description = "Removes a group mapping from the role.")
    @ApiResponse(responseCode = "200", description = "Updated client role returned.")
    AdminClientRoleDetailDTO removeGroup(
            @PathVariable String clientId,
            @PathVariable Long roleId,
            @PathVariable Long groupId,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return service.removeGroup(clientId, roleId, groupId, pageable);
    }
}
