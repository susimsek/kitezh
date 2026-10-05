package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.SocialProviderTokenDTO;
import io.github.susimsek.kitezh.service.SocialTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account/social-links")
@RequiredArgsConstructor
@Tag(name = "Account social tokens", description = "Controlled access to stored provider tokens.")
public class SocialTokenController {

    private final SocialTokenService socialTokenService;

    @GetMapping("/{provider}/token")
    @Operation(
            summary = "Read a stored provider token",
            description =
                    "Returns the linked provider access and refresh tokens only when the"
                            + " administrator has enabled Stored Tokens Readable.")
    @ApiResponse(responseCode = "200", description = "Stored token returned.")
    @ApiResponse(responseCode = "403", description = "Stored tokens are not readable.")
    @ApiResponse(responseCode = "404", description = "Provider or token was not found.")
    SocialProviderTokenDTO token(@PathVariable String provider, Authentication authentication) {
        return socialTokenService.read(authentication.getName(), provider);
    }
}
