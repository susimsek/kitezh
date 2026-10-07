package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationClaimDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationClaimRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationGroupRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationService;
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
@RequestMapping("/api/admin/organizations")
@RequiredArgsConstructor
@Tag(name = "Admin - Organizations", description = "Keycloak-style organization administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationController {

    private final AdminOrganizationService service;

    @GetMapping
    @Operation(
            summary = "Search organizations",
            description = "Returns bounded organization results.")
    @ApiResponse(responseCode = "200", description = "Organizations returned.")
    Page<AdminOrganizationDTO> findAll(
            @Parameter(description = "Alias or name search.") @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return service.findAll(q, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get organization", description = "Returns one organization.")
    @ApiResponse(responseCode = "200", description = "Organization returned.")
    AdminOrganizationDTO findById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @Operation(summary = "Create organization", description = "Creates an organization.")
    @ApiResponse(responseCode = "201", description = "Organization created.")
    ResponseEntity<AdminOrganizationDTO> create(
            @Valid @RequestBody AdminOrganizationRequestDTO request) {
        AdminOrganizationDTO created = service.create(request);
        return ResponseEntity.created(URI.create("/api/admin/organizations/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update organization", description = "Updates organization metadata.")
    @ApiResponse(responseCode = "200", description = "Organization updated.")
    AdminOrganizationDTO update(
            @PathVariable Long id, @Valid @RequestBody AdminOrganizationRequestDTO request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete organization",
            description = "Deletes an organization and its resources.")
    @ApiResponse(responseCode = "204", description = "Organization deleted.")
    ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    @Operation(summary = "List organization members", description = "Returns organization members.")
    Page<AdminOrganizationMemberDTO> members(
            @PathVariable Long id,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "user.username") Pageable pageable) {
        return service.members(id, q, pageable);
    }

    @PostMapping("/{id}/members")
    @Operation(summary = "Add organization member", description = "Adds a user to an organization.")
    AdminOrganizationMemberDTO addMember(
            @PathVariable Long id, @Valid @RequestBody AdminOrganizationMemberRequestDTO request) {
        return service.addMember(id, request);
    }

    @PutMapping("/{id}/members/{userId}")
    @Operation(summary = "Update organization member", description = "Changes a membership role.")
    AdminOrganizationMemberDTO updateMember(
            @PathVariable Long id,
            @PathVariable Long userId,
            @Valid @RequestBody AdminOrganizationMemberRequestDTO request) {
        return service.updateMember(id, userId, request);
    }

    @DeleteMapping("/{id}/members/{userId}")
    @Operation(
            summary = "Remove organization member",
            description = "Removes a user from an organization.")
    ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long userId) {
        service.removeMember(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/domains")
    @Operation(summary = "List organization domains", description = "Returns organization domains.")
    List<AdminOrganizationDomainDTO> domains(@PathVariable Long id) {
        return service.domains(id);
    }

    @PostMapping("/{id}/domains")
    @Operation(summary = "Add organization domain", description = "Adds an unverified domain.")
    AdminOrganizationDomainDTO addDomain(
            @PathVariable Long id, @Valid @RequestBody AdminOrganizationDomainRequestDTO request) {
        return service.addDomain(id, request);
    }

    @PostMapping("/{id}/domains/{domainId}/verify")
    @Operation(
            summary = "Verify organization domain",
            description = "Marks a domain as verified after proof.")
    AdminOrganizationDomainDTO verifyDomain(@PathVariable Long id, @PathVariable Long domainId) {
        return service.verifyDomain(id, domainId);
    }

    @DeleteMapping("/{id}/domains/{domainId}")
    @Operation(summary = "Remove organization domain", description = "Removes a domain.")
    ResponseEntity<Void> removeDomain(@PathVariable Long id, @PathVariable Long domainId) {
        service.removeDomain(id, domainId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/invitations")
    @Operation(
            summary = "List organization invitations",
            description = "Returns invitation history.")
    Page<AdminOrganizationInvitationDTO> invitations(
            @PathVariable Long id,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return service.invitations(id, pageable);
    }

    @PostMapping("/{id}/invitations")
    @Operation(
            summary = "Create organization invitation",
            description = "Creates a one-time invitation token.")
    AdminOrganizationInvitationDTO createInvitation(
            @PathVariable Long id,
            @Valid @RequestBody AdminOrganizationInvitationRequestDTO request) {
        return service.createInvitation(id, request);
    }

    @DeleteMapping("/{id}/invitations/{invitationId}")
    @Operation(summary = "Revoke organization invitation", description = "Revokes an invitation.")
    ResponseEntity<Void> revokeInvitation(@PathVariable Long id, @PathVariable Long invitationId) {
        service.revokeInvitation(id, invitationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/groups")
    @Operation(
            summary = "List organization groups",
            description = "Returns organization-scoped groups.")
    Page<AdminOrganizationGroupDTO> groups(
            @PathVariable Long id,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return service.groups(id, q, pageable);
    }

    @PostMapping("/{id}/groups")
    @Operation(
            summary = "Create organization group",
            description = "Creates a group inside an organization.")
    AdminOrganizationGroupDTO createGroup(
            @PathVariable Long id, @Valid @RequestBody AdminOrganizationGroupRequestDTO request) {
        return service.createGroup(id, request);
    }

    @PutMapping("/{id}/groups/{groupId}")
    @Operation(
            summary = "Update organization group",
            description = "Updates an organization group.")
    AdminOrganizationGroupDTO updateGroup(
            @PathVariable Long id,
            @PathVariable Long groupId,
            @Valid @RequestBody AdminOrganizationGroupRequestDTO request) {
        return service.updateGroup(id, groupId, request);
    }

    @DeleteMapping("/{id}/groups/{groupId}")
    @Operation(
            summary = "Delete organization group",
            description = "Deletes an empty organization group.")
    ResponseEntity<Void> deleteGroup(@PathVariable Long id, @PathVariable Long groupId) {
        service.deleteGroup(id, groupId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/groups/{groupId}/members")
    @Operation(summary = "List organization group members", description = "Returns group members.")
    Page<AdminOrganizationMemberDTO> groupMembers(
            @PathVariable Long id,
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "user.username") Pageable pageable) {
        return service.groupMembers(id, groupId, q, pageable);
    }

    @GetMapping("/{id}/groups/{groupId}/available-members")
    @Operation(
            summary = "List available organization group members",
            description = "Returns organization members not yet in the group.")
    Page<AdminOrganizationMemberDTO> availableGroupMembers(
            @PathVariable Long id,
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return service.availableGroupMembers(id, groupId, q, pageable);
    }

    @PostMapping("/{id}/groups/{groupId}/members/{userId}")
    @Operation(
            summary = "Add organization group member",
            description = "Adds an organization member to a group.")
    ResponseEntity<Void> addGroupMember(
            @PathVariable Long id, @PathVariable Long groupId, @PathVariable Long userId) {
        service.addGroupMember(id, groupId, userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/groups/{groupId}/members/{userId}")
    @Operation(
            summary = "Remove organization group member",
            description = "Removes a member from a group.")
    ResponseEntity<Void> removeGroupMember(
            @PathVariable Long id, @PathVariable Long groupId, @PathVariable Long userId) {
        service.removeGroupMember(id, groupId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/claims")
    @Operation(
            summary = "List organization claims",
            description = "Returns token claims configured for the organization.")
    List<AdminOrganizationClaimDTO> claims(@PathVariable Long id) {
        return service.claims(id);
    }

    @PostMapping("/{id}/claims")
    @Operation(summary = "Create organization claim", description = "Creates a token claim.")
    AdminOrganizationClaimDTO createClaim(
            @PathVariable Long id, @Valid @RequestBody AdminOrganizationClaimRequestDTO request) {
        return service.createClaim(id, request);
    }

    @PutMapping("/{id}/claims/{claimId}")
    @Operation(summary = "Update organization claim", description = "Updates a token claim.")
    AdminOrganizationClaimDTO updateClaim(
            @PathVariable Long id,
            @PathVariable Long claimId,
            @Valid @RequestBody AdminOrganizationClaimRequestDTO request) {
        return service.updateClaim(id, claimId, request);
    }

    @DeleteMapping("/{id}/claims/{claimId}")
    @Operation(summary = "Delete organization claim", description = "Deletes a token claim.")
    ResponseEntity<Void> deleteClaim(@PathVariable Long id, @PathVariable Long claimId) {
        service.deleteClaim(id, claimId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/identity-providers")
    @Operation(
            summary = "List organization identity providers",
            description = "Returns linked providers.")
    List<AdminOrganizationIdentityProviderDTO> identityProviders(@PathVariable Long id) {
        return service.identityProviders(id);
    }

    @PostMapping("/{id}/identity-providers")
    @Operation(
            summary = "Link organization identity provider",
            description = "Links a configured provider.")
    AdminOrganizationIdentityProviderDTO addIdentityProvider(
            @PathVariable Long id,
            @Valid @RequestBody AdminOrganizationIdentityProviderRequestDTO request) {
        return service.addIdentityProvider(id, request.providerAlias());
    }

    @DeleteMapping("/{id}/identity-providers/{providerAlias}")
    @Operation(
            summary = "Unlink organization identity provider",
            description = "Removes a provider link.")
    ResponseEntity<Void> removeIdentityProvider(
            @PathVariable Long id, @PathVariable String providerAlias) {
        service.removeIdentityProvider(id, providerAlias);
        return ResponseEntity.noContent().build();
    }
}
