package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminClientRoleDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleDetailDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleUserDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleUserRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminRoleService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
@RequestMapping("/api/admin/roles")
@RequiredArgsConstructor
@Tag(name = "Admin - Roles", description = "Role and role membership administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminRoleController {

    private final AdminRoleService adminRoleService;

    @GetMapping
    @Operation(summary = "Search roles", description = "Returns a paged list of realm roles.")
    @ApiResponse(responseCode = "200", description = "Paged roles returned.")
    Page<AdminRoleDTO> roles(
            @Parameter(description = "Optional role-name search text.", example = "USER")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminRoleService.roles(q, pageable);
    }

    @GetMapping("/{name}")
    @Operation(
            summary = "Get role",
            description = "Returns role details and its paged user membership.")
    @ApiResponse(responseCode = "200", description = "Role details returned.")
    AdminRoleDetailDTO role(
            @Parameter(
                            description = "Realm role name.",
                            example = "ROLE_USER_VIEWER",
                            required = true)
                    @PathVariable
                    String name,
            @Parameter(
                            description = "Optional username, email, or name search text.",
                            example = "user")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(description = "Filter assigned users by enabled state.", example = "true")
                    @RequestParam(required = false)
                    Boolean enabled,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return adminRoleService.role(name, q, enabled, pageable);
    }

    @GetMapping("/{name}/available-users")
    @Operation(
            summary = "Search users available for a role",
            description = "Returns enabled users who are not currently assigned to the role.")
    @ApiResponse(responseCode = "200", description = "Paged eligible users returned.")
    Page<AdminRoleUserDTO> availableRoleUsers(
            @Parameter(
                            description = "Realm role name.",
                            example = "ROLE_USER_VIEWER",
                            required = true)
                    @PathVariable
                    String name,
            @Parameter(
                            description = "Optional username, email, or name search text.",
                            example = "user")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 10, sort = "username") Pageable pageable) {
        return adminRoleService.availableUsers(name, q, pageable);
    }

    @GetMapping("/{name}/available-composites")
    @Operation(
            summary = "Search roles available as composite children",
            description = "Returns roles that can be included without creating a cycle.")
    @ApiResponse(responseCode = "200", description = "Paged composite candidates returned.")
    Page<AdminRoleDTO> availableComposites(
            @PathVariable String name,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 10, sort = "name") Pageable pageable) {
        return adminRoleService.availableComposites(name, q, pageable);
    }

    @GetMapping("/{name}/available-client-composites")
    @Operation(
            summary = "Search client roles available as composite children",
            description = "Returns client roles that can be included without creating a cycle.")
    @ApiResponse(responseCode = "200", description = "Paged client-role candidates returned.")
    Page<AdminClientRoleDTO> availableClientComposites(
            @PathVariable String name,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 10, sort = "name") Pageable pageable) {
        return adminRoleService.availableClientComposites(name, q, pageable);
    }

    @PostMapping("/{name}/composites/{childName}")
    @Operation(
            summary = "Add a composite child role",
            description = "Includes one realm role in another after cycle validation.")
    @ApiResponse(responseCode = "200", description = "Updated role details returned.")
    AdminRoleDetailDTO addComposite(
            @PathVariable String name,
            @PathVariable String childName,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return adminRoleService.addComposite(name, childName, pageable);
    }

    @DeleteMapping("/{name}/composites/{childName}")
    @Operation(
            summary = "Remove a composite child role",
            description = "Removes one realm role from a composite role.")
    @ApiResponse(responseCode = "200", description = "Updated role details returned.")
    AdminRoleDetailDTO removeComposite(
            @PathVariable String name,
            @PathVariable String childName,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return adminRoleService.removeComposite(name, childName, pageable);
    }

    @PostMapping("/{name}/client-composites/{childRoleId}")
    @Operation(
            summary = "Add a client role to a composite realm role",
            description = "Includes one client role in a realm role after cycle validation.")
    @ApiResponse(responseCode = "200", description = "Updated role details returned.")
    AdminRoleDetailDTO addClientComposite(
            @PathVariable String name,
            @PathVariable Long childRoleId,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return adminRoleService.addClientComposite(name, childRoleId, pageable);
    }

    @DeleteMapping("/{name}/client-composites/{childRoleId}")
    @Operation(
            summary = "Remove a client role from a composite realm role",
            description = "Removes one client role from a realm role composite.")
    @ApiResponse(responseCode = "200", description = "Updated role details returned.")
    AdminRoleDetailDTO removeClientComposite(
            @PathVariable String name,
            @PathVariable Long childRoleId,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return adminRoleService.removeClientComposite(name, childRoleId, pageable);
    }

    @PostMapping("/{name}/users")
    @Operation(
            summary = "Assign user to role",
            description = "Assigns a user to the role and returns the updated role details.")
    @ApiResponse(responseCode = "200", description = "Updated role details returned.")
    AdminRoleDetailDTO assignRoleUser(
            @Parameter(
                            description = "Realm role name.",
                            example = "ROLE_USER_VIEWER",
                            required = true)
                    @PathVariable
                    String name,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "User to assign.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminRoleUserRequestDTO request,
            @PageableDefault(size = 20, sort = "username") Pageable pageable,
            Authentication authentication) {
        return adminRoleService.assignUser(
                name, request.userId(), authentication.getName(), pageable);
    }

    @DeleteMapping("/{name}/users/{userId}")
    @Operation(
            summary = "Remove user from role",
            description = "Removes a user from the role and returns the updated role details.")
    @ApiResponse(responseCode = "200", description = "Updated role details returned.")
    AdminRoleDetailDTO removeRoleUser(
            @Parameter(
                            description = "Realm role name.",
                            example = "ROLE_USER_VIEWER",
                            required = true)
                    @PathVariable
                    String name,
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long userId,
            @PageableDefault(size = 20, sort = "username") Pageable pageable,
            Authentication authentication) {
        return adminRoleService.removeUser(name, userId, authentication.getName(), pageable);
    }

    @PostMapping
    @Operation(summary = "Create role", description = "Creates a new realm role.")
    @ApiResponse(responseCode = "201", description = "Role created and returned.")
    ResponseEntity<AdminRoleDTO> createRole(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Role name and optional description.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminRoleRequestDTO request) {
        AdminRoleDTO created =
                request.description() == null
                        ? adminRoleService.createRole(request.name())
                        : adminRoleService.createRole(request.name(), request.description());
        return ResponseEntity.status(201).body(created);
    }

    @PutMapping("/{name}")
    @Operation(summary = "Update role", description = "Updates a realm role description.")
    @ApiResponse(responseCode = "200", description = "Role updated and returned.")
    AdminRoleDTO updateRole(
            @Parameter(description = "Realm role name.", example = "ROLE_AUDITOR", required = true)
                    @PathVariable
                    String name,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Updated role description.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminRoleRequestDTO request) {
        return adminRoleService.updateRole(name, request.description());
    }

    @DeleteMapping("/{name}")
    @Operation(summary = "Delete role", description = "Deletes a non-protected realm role.")
    @ApiResponse(responseCode = "204", description = "Role deleted.")
    ResponseEntity<Void> deleteRole(
            @Parameter(description = "Realm role name.", example = "ROLE_AUDITOR", required = true)
                    @PathVariable
                    String name) {
        adminRoleService.deleteRole(name);
        return ResponseEntity.noContent().build();
    }
}
