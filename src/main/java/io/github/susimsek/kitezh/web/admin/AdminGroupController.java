package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupPermissionsRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupRolesRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupUserDTO;
import io.github.susimsek.kitezh.dto.admin.AdminGroupUserRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminGroupService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
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
@RequestMapping("/api/admin/groups")
@RequiredArgsConstructor
@Tag(
        name = "Admin - Groups",
        description = "Keycloak-style groups, memberships, and realm-role mappings.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminGroupController {

    private final AdminGroupService adminGroupService;

    @GetMapping
    @Operation(
            summary = "Search groups",
            description = "Returns a paged group list. `size` is capped at 100.")
    @ApiResponse(responseCode = "200", description = "Paged groups returned.")
    Page<AdminGroupDTO> findAll(
            @Parameter(
                            description = "Optional group name or path search text.",
                            example = "finance")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable,
            Authentication authentication) {
        return adminGroupService.findAll(q, pageable, authentication.getName());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get group", description = "Returns one group by its internal identifier.")
    @ApiResponse(responseCode = "200", description = "Group returned.")
    AdminGroupDTO findById(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        return adminGroupService.findById(id, authentication.getName());
    }

    @PostMapping
    @Operation(
            summary = "Create group",
            description = "Creates a group, optionally nested under a parent group.")
    @ApiResponse(responseCode = "201", description = "Group created and returned.")
    ResponseEntity<AdminGroupDTO> create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Group name and optional parent.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminGroupRequestDTO request) {
        AdminGroupDTO created = adminGroupService.create(request);
        return ResponseEntity.created(URI.create("/api/admin/groups/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Rename group",
            description = "Changes a group's name or parent relationship.")
    @ApiResponse(responseCode = "200", description = "Updated group returned.")
    AdminGroupDTO update(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Updated group name and optional parent.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminGroupRequestDTO request,
            Authentication authentication) {
        return adminGroupService.update(id, request, authentication.getName());
    }

    @PutMapping("/{id}/roles")
    @Operation(
            summary = "Replace group role mappings",
            description = "Replaces the complete set of realm roles mapped to the group.")
    @ApiResponse(responseCode = "200", description = "Updated group returned.")
    AdminGroupDTO updateRoles(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Complete role mapping.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminGroupRolesRequestDTO request,
            Authentication authentication) {
        return adminGroupService.updateRoles(id, request, authentication.getName());
    }

    @GetMapping("/{id}/users")
    @Operation(
            summary = "List group members",
            description = "Returns users currently assigned to the group.")
    @ApiResponse(responseCode = "200", description = "Paged group members returned.")
    Page<AdminGroupUserDTO> users(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            @Parameter(description = "Optional username search text.", example = "user")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "username") Pageable pageable,
            Authentication authentication) {
        return adminGroupService.users(id, q, pageable, authentication.getName());
    }

    @GetMapping("/{id}/available-users")
    @Operation(
            summary = "Search users that are not group members",
            description = "Returns users eligible to be added to the group.")
    @ApiResponse(responseCode = "200", description = "Paged eligible users returned.")
    Page<AdminGroupUserDTO> availableUsers(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            @Parameter(description = "Optional username search text.", example = "user")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 10, sort = "username") Pageable pageable,
            Authentication authentication) {
        return adminGroupService.availableUsers(id, q, pageable, authentication.getName());
    }

    @PostMapping("/{id}/users")
    @Operation(
            summary = "Add user to group",
            description = "Adds a user to the group and returns the updated group.")
    @ApiResponse(responseCode = "200", description = "Updated group returned.")
    AdminGroupDTO addUser(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "User to add.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminGroupUserRequestDTO request,
            Authentication authentication) {
        return adminGroupService.addUser(id, request.userId(), authentication.getName());
    }

    @DeleteMapping("/{id}/users/{userId}")
    @Operation(
            summary = "Remove user from group",
            description = "Removes a user from the group and returns the updated group.")
    @ApiResponse(responseCode = "200", description = "Updated group returned.")
    AdminGroupDTO removeUser(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long userId,
            Authentication authentication) {
        return adminGroupService.removeUser(id, userId, authentication.getName());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete group", description = "Deletes a group and its memberships.")
    @ApiResponse(responseCode = "204", description = "Group deleted.")
    ResponseEntity<Void> delete(
            @Parameter(description = "Internal group identifier.", example = "1", required = true)
                    @PathVariable
                    Long id,
            Authentication authentication) {
        adminGroupService.delete(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/permissions")
    @Operation(
            summary = "List group-scoped permissions",
            description = "Returns administrator permissions assigned to this group.")
    @ApiResponse(responseCode = "200", description = "Group permissions returned.")
    List<AdminGroupPermissionDTO> permissions(@PathVariable Long id) {
        return adminGroupService.permissions(id);
    }

    @PutMapping("/{id}/permissions")
    @Operation(
            summary = "Replace group-scoped permissions",
            description = "Replaces administrator permissions for this group and its descendants.")
    @ApiResponse(responseCode = "200", description = "Group permissions returned.")
    List<AdminGroupPermissionDTO> updatePermissions(
            @PathVariable Long id, @Valid @RequestBody AdminGroupPermissionsRequestDTO request) {
        return adminGroupService.updatePermissions(id, request);
    }
}
