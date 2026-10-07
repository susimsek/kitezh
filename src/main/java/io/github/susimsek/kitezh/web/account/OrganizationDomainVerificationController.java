package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.OrganizationDomainVerificationRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainVerificationDTO;
import io.github.susimsek.kitezh.service.admin.OrganizationDomainVerificationService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/auth/organization-domains")
@RequiredArgsConstructor
@Tag(name = "Organization domain verification")
public class OrganizationDomainVerificationController {

    private final OrganizationDomainVerificationService verificationService;

    @PostMapping("/verify")
    @Operation(summary = "Verify an organization domain")
    @ApiResponse(responseCode = "200", description = "Domain verified.")
    AdminOrganizationDomainVerificationDTO verify(
            @Valid @RequestBody OrganizationDomainVerificationRequestDTO request) {
        return verificationService.verify(request.token());
    }

    @GetMapping("/verify")
    @Operation(summary = "Verify an organization domain from an email link")
    @ApiResponse(responseCode = "200", description = "Domain verified.")
    AdminOrganizationDomainVerificationDTO verifyFromEmail(@RequestParam String token) {
        return verificationService.verify(token);
    }
}
