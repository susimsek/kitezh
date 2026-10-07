package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.OrganizationInvitationAcceptanceDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationInvitationService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/account/organization-invitations")
@RequiredArgsConstructor
@Tag(
        name = "Account - Organization invitations",
        description = "Authenticated organization invitation acceptance.")
@SecurityRequirement(name = "account-bearer")
public class AccountOrganizationInvitationController {

    private final AdminOrganizationInvitationService invitationService;

    @PostMapping("/accept")
    @Operation(
            summary = "Accept organization invitation",
            description = "Accepts a pending invitation for the authenticated user's email.")
    @ApiResponse(responseCode = "200", description = "Invitation accepted.")
    OrganizationInvitationAcceptanceDTO accept(
            @RequestParam @NotBlank String token, Authentication authentication) {
        return invitationService.accept(token, authentication.getName());
    }
}
