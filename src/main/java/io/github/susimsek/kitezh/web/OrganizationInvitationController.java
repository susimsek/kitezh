package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/organizations/invitations")
@Tag(name = "Organizations", description = "Organization invitation acceptance.")
@SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
public class OrganizationInvitationController {

    private final AdminOrganizationService service;

    @PostMapping("/{token}/accept")
    @Operation(
            summary = "Accept organization invitation",
            description = "Accepts a valid one-time invitation for the authenticated user.")
    @ApiResponse(responseCode = "200", description = "Invitation accepted.")
    public AdminOrganizationMemberDTO accept(@PathVariable String token, Principal principal) {
        return service.acceptInvitation(token, principal.getName());
    }
}
