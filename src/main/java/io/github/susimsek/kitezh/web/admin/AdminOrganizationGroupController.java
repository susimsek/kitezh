package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupMemberRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationGroupService;
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

@RestController
@ApiController
@RequestMapping("/api/admin/organizations/{organizationId}/groups")
@RequiredArgsConstructor
@Tag(name = "Admin - Organization groups", description = "Organization-scoped group management.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationGroupController {

    private final AdminOrganizationGroupService groupService;

    @GetMapping
    @Operation(
            summary = "List organization groups",
            description = "Returns a paged organization group list.")
    @ApiResponse(responseCode = "200", description = "Paged groups returned.")
    Page<AdminOrganizationGroupDTO> findAll(
            @PathVariable Long organizationId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return groupService.findAll(organizationId, q, pageable);
    }

    @GetMapping("/{groupId}")
    @Operation(summary = "Get organization group", description = "Returns one organization group.")
    AdminOrganizationGroupDTO findById(
            @PathVariable Long organizationId, @PathVariable Long groupId) {
        return groupService.findById(organizationId, groupId);
    }

    @PostMapping
    @Operation(
            summary = "Create organization group",
            description = "Creates a group scoped to an organization.")
    @ApiResponse(responseCode = "201", description = "Organization group created.")
    ResponseEntity<AdminOrganizationGroupDTO> create(
            @PathVariable Long organizationId,
            @Valid @RequestBody AdminOrganizationGroupRequestDTO request) {
        AdminOrganizationGroupDTO created = groupService.create(organizationId, request);
        return ResponseEntity.created(
                        URI.create(
                                "/api/admin/organizations/"
                                        + organizationId
                                        + "/groups/"
                                        + created.id()))
                .body(created);
    }

    @PutMapping("/{groupId}")
    @Operation(
            summary = "Update organization group",
            description = "Updates an organization-scoped group.")
    AdminOrganizationGroupDTO update(
            @PathVariable Long organizationId,
            @PathVariable Long groupId,
            @Valid @RequestBody AdminOrganizationGroupRequestDTO request) {
        return groupService.update(organizationId, groupId, request);
    }

    @GetMapping("/{groupId}/members")
    @Operation(summary = "List organization group members", description = "Returns group members.")
    Page<AdminOrganizationMemberDTO> findMembers(
            @PathVariable Long organizationId,
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "user.username") Pageable pageable) {
        return groupService.findMembers(organizationId, groupId, q, pageable);
    }

    @PostMapping("/{groupId}/members")
    @Operation(
            summary = "Add organization group member",
            description = "Adds an existing organization member to a group.")
    ResponseEntity<AdminOrganizationMemberDTO> addMember(
            @PathVariable Long organizationId,
            @PathVariable Long groupId,
            @Valid @RequestBody AdminOrganizationGroupMemberRequestDTO request) {
        AdminOrganizationMemberDTO member =
                groupService.addMember(organizationId, groupId, request.userId());
        return ResponseEntity.created(
                        URI.create(
                                "/api/admin/organizations/"
                                        + organizationId
                                        + "/groups/"
                                        + groupId
                                        + "/members/"
                                        + request.userId()))
                .body(member);
    }

    @DeleteMapping("/{groupId}/members/{userId}")
    @Operation(
            summary = "Remove organization group member",
            description = "Removes group membership without deleting the user.")
    ResponseEntity<Void> removeMember(
            @PathVariable Long organizationId,
            @PathVariable Long groupId,
            @PathVariable Long userId) {
        groupService.removeMember(organizationId, groupId, userId);
        return ResponseEntity.noContent().build();
    }
}
