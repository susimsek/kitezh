package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.SocialProviderDTO;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Public authentication", description = "Public login and social provider discovery.")
public class SocialLoginController {

    private final SocialLoginService socialLoginService;

    @GetMapping("/social-providers")
    @Operation(
            summary = "List enabled social login providers",
            description =
                    "Returns enabled providers. An unconfigured OAuth provider remains visible"
                            + " but is not usable until its client credentials are saved; SAML"
                            + " providers use their metadata or asserting-party configuration.")
    @ApiResponse(responseCode = "200", description = "Social provider availability returned.")
    java.util.List<SocialProviderDTO> providers() {
        return socialLoginService.availableProviders();
    }
}
