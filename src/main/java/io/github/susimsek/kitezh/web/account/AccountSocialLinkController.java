package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkCompleteRequestDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkCompleteResponseDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkStartRequestDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkStartResponseDTO;
import io.github.susimsek.kitezh.dto.account.SocialLinkDTO;
import io.github.susimsek.kitezh.service.DesktopSocialLinkTransactionService;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@ApiController
@RestController
@RequestMapping("/api/account")
@Tag(name = "Account social links", description = "Account social identity linking.")
@SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
public class AccountSocialLinkController {

    private final SocialLoginService socialLoginService;
    private final DesktopSocialLinkTransactionService desktopSocialLinkTransactionService;

    @Autowired
    public AccountSocialLinkController(
            SocialLoginService socialLoginService,
            DesktopSocialLinkTransactionService desktopSocialLinkTransactionService) {
        this.socialLoginService = socialLoginService;
        this.desktopSocialLinkTransactionService = desktopSocialLinkTransactionService;
    }

    public AccountSocialLinkController(SocialLoginService socialLoginService) {
        this(socialLoginService, null);
    }

    @GetMapping("/social-links")
    @Operation(
            summary = "List social account links",
            description = "Returns enabled social providers, configuration state, and link status.")
    @ApiResponse(responseCode = "200", description = "Social account links returned.")
    List<SocialLinkDTO> links(Authentication authentication) {
        return socialLoginService.socialLinks(authentication.getName());
    }

    @DeleteMapping("/social-links/{provider}")
    @Operation(
            summary = "Remove a social account link",
            description = "Removes the selected social identity from the authenticated account.")
    @ApiResponse(responseCode = "204", description = "Social account link removed.")
    ResponseEntity<Void> unlink(Authentication authentication, @PathVariable String provider) {
        socialLoginService.unlink(authentication.getName(), provider);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/social-links/{provider}/desktop/start")
    @Operation(
            summary = "Start a native desktop social account link",
            description =
                    "Creates a short-lived PKCE-bound browser handoff for the authenticated desktop"
                            + " account.")
    @ApiResponse(responseCode = "200", description = "Desktop social-link handoff created.")
    DesktopSocialLinkStartResponseDTO startDesktopLink(
            Authentication authentication,
            @PathVariable String provider,
            @Valid @RequestBody DesktopSocialLinkStartRequestDTO request,
            HttpServletRequest httpRequest) {
        String baseUrl =
                ServletUriComponentsBuilder.fromRequestUri(httpRequest)
                        .replacePath(null)
                        .replaceQuery(null)
                        .build()
                        .toUriString();
        return desktopSocialLinkTransactionService.start(
                authentication.getName(), provider, request, baseUrl);
    }

    @PostMapping("/social-links/desktop/complete")
    @Operation(
            summary = "Complete a native desktop social account link",
            description =
                    "Consumes the one-time callback code after the provider callback succeeds.")
    @ApiResponse(responseCode = "200", description = "Desktop social link completed.")
    DesktopSocialLinkCompleteResponseDTO completeDesktopLink(
            Authentication authentication,
            @Valid @RequestBody DesktopSocialLinkCompleteRequestDTO request) {
        return desktopSocialLinkTransactionService.complete(authentication.getName(), request);
    }
}
