package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenCreatedDTO;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenDTO;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenRequestDTO;
import io.github.susimsek.kitezh.service.account.PersonalAccessTokenService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/account/personal-access-tokens")
@RequiredArgsConstructor
@Tag(name = "Account Personal Access Tokens", description = "Manage personal MCP access tokens.")
@SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
public class AccountPersonalAccessTokenController {

    private final PersonalAccessTokenService personalAccessTokenService;

    @GetMapping
    @Operation(
            summary = "List personal access tokens",
            description =
                    "Returns metadata for the authenticated account's MCP tokens. Secret token"
                            + " values are never returned.")
    @ApiResponse(responseCode = "200", description = "Personal access token metadata returned.")
    List<PersonalAccessTokenDTO> list(Authentication authentication) {
        return personalAccessTokenService.list(authentication.getName());
    }

    @PostMapping
    @Operation(
            summary = "Create a personal access token",
            description =
                    "Creates a read-only MCP token and returns its bearer value once. Save it"
                            + " securely; it cannot be viewed again.")
    @ApiResponse(
            responseCode = "201",
            description = "Personal access token created and returned once.")
    ResponseEntity<PersonalAccessTokenCreatedDTO> create(
            Authentication authentication,
            @Valid @RequestBody PersonalAccessTokenRequestDTO request) {
        return ResponseEntity.status(201)
                .cacheControl(CacheControl.noStore())
                .body(personalAccessTokenService.create(authentication.getName(), request));
    }

    @DeleteMapping("/{tokenId}")
    @Operation(
            summary = "Revoke a personal access token",
            description =
                    "Revokes one token belonging to the authenticated account. Future MCP API"
                            + " access is rejected.")
    @ApiResponse(responseCode = "204", description = "Personal access token revoked.")
    ResponseEntity<Void> revoke(Authentication authentication, @PathVariable String tokenId) {
        personalAccessTokenService.revoke(authentication.getName(), tokenId);
        return ResponseEntity.noContent().build();
    }
}
