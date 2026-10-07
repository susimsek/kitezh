package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationInvitationRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationInvitationService;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/organizations/{organizationId}/invitations")
@RequiredArgsConstructor
@Tag(name = "Admin - Organization invitations", description = "Organization invitation management.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationInvitationController {

    private final AdminOrganizationInvitationService invitationService;

    @GetMapping
    @Operation(
            summary = "List organization invitations",
            description = "Returns a paged invitation list.")
    @ApiResponse(responseCode = "200", description = "Paged invitations returned.")
    Page<AdminOrganizationInvitationDTO> findAll(
            @PathVariable Long organizationId,
            @PageableDefault(size = 20, sort = "expiresAt") Pageable pageable) {
        return invitationService.findAll(organizationId, pageable);
    }

    @PostMapping
    @Operation(
            summary = "Create organization invitation",
            description = "Creates a one-time expiring invitation.")
    @ApiResponse(responseCode = "201", description = "Invitation created.")
    ResponseEntity<AdminOrganizationInvitationDTO> create(
            @PathVariable Long organizationId,
            @Valid @RequestBody AdminOrganizationInvitationRequestDTO request) {
        AdminOrganizationInvitationDTO invitation =
                invitationService.create(organizationId, request);
        return ResponseEntity.created(
                        URI.create(
                                "/api/admin/organizations/"
                                        + organizationId
                                        + "/invitations/"
                                        + invitation.id()))
                .body(invitation);
    }

    @PostMapping("/{invitationId}/resend")
    @Operation(
            summary = "Resend organization invitation",
            description = "Rotates the invitation token and expiration.")
    AdminOrganizationInvitationDTO resend(
            @PathVariable Long organizationId,
            @PathVariable Long invitationId,
            @Valid @RequestBody AdminOrganizationInvitationRequestDTO request) {
        return invitationService.resend(organizationId, invitationId, request);
    }

    @PostMapping("/{invitationId}/cancel")
    @Operation(
            summary = "Cancel organization invitation",
            description = "Cancels a pending invitation without deleting its audit history.")
    ResponseEntity<Void> cancel(
            @PathVariable Long organizationId, @PathVariable Long invitationId) {
        invitationService.cancel(organizationId, invitationId);
        return ResponseEntity.noContent().build();
    }
}
