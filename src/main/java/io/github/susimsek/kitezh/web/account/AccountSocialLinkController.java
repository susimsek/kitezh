package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.account.SocialLinkDTO;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
@Tag(name = "Account social links", description = "Account social identity linking.")
@SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
public class AccountSocialLinkController {

    private final SocialLoginService socialLoginService;

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
}
