package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminConsentDTO;
import io.github.susimsek.kitezh.service.admin.AdminConsentService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin - Consents", description = "OAuth2 consent administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminConsentController {

    private final AdminConsentService adminConsentService;

    @GetMapping("/users/{id}/consents")
    @Operation(
            summary = "List user consents",
            description = "Returns OAuth2 consents granted by the specified user.")
    @ApiResponse(responseCode = "200", description = "Paged user consents returned.")
    Page<AdminConsentDTO> userConsents(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @PageableDefault(size = 20, sort = "id.registeredClientId") Pageable pageable,
            Authentication authentication) {
        return adminConsentService.userConsents(id, authentication.getName(), pageable);
    }

    @GetMapping("/consents")
    @Operation(
            summary = "Search user consents",
            description = "Searches OAuth2 consents by client, user, and scope filters.")
    @ApiResponse(responseCode = "200", description = "Paged matching consents returned.")
    Page<AdminConsentDTO> consents(
            @Parameter(description = "Free-text client or user search.", example = "account")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(
                            description = "Registered client identifier filter.",
                            example = "account-console")
                    @RequestParam(defaultValue = "")
                    String clientId,
            @Parameter(description = "Username filter.", example = "user")
                    @RequestParam(defaultValue = "")
                    String username,
            @Parameter(description = "Granted scope filter.", example = "account-api")
                    @RequestParam(defaultValue = "")
                    String scope,
            @PageableDefault(size = 20, sort = "id.principalName") Pageable pageable) {
        return adminConsentService.consents(q, clientId, username, scope, pageable);
    }

    @GetMapping("/consents/{clientId}/{username}")
    @Operation(
            summary = "Get user consent",
            description = "Returns one user's consent for a registered client.")
    @ApiResponse(responseCode = "200", description = "Consent returned.")
    AdminConsentDTO consent(
            @Parameter(
                            description = "Registered client identifier.",
                            example = "account-console",
                            required = true)
                    @PathVariable
                    String clientId,
            @Parameter(
                            description = "Username that granted consent.",
                            example = "user",
                            required = true)
                    @PathVariable
                    String username) {
        return adminConsentService.consent(clientId, username);
    }

    @DeleteMapping("/consents/{clientId}/{username}")
    @Operation(
            summary = "Revoke user consent",
            description =
                    "Revokes all consent and associated authorization state for a user and client.")
    @ApiResponse(responseCode = "204", description = "Consent revoked.")
    ResponseEntity<Void> revokeConsent(
            @Parameter(
                            description = "Registered client identifier.",
                            example = "account-console",
                            required = true)
                    @PathVariable
                    String clientId,
            @Parameter(
                            description = "Username that granted consent.",
                            example = "user",
                            required = true)
                    @PathVariable
                    String username,
            Authentication authentication) {
        adminConsentService.revokeConsent(clientId, username, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
