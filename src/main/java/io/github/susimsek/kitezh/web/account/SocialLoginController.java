package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.SocialProviderDTO;
import io.github.susimsek.kitezh.service.MobileSocialLoginTransactionService;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Public authentication", description = "Public login and social provider discovery.")
public class SocialLoginController {

    private final SocialLoginService socialLoginService;
    private final MobileSocialLoginTransactionService mobileSocialLoginTransactionService;

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

    @GetMapping("/mobile-social-login/{provider}")
    @Operation(
            summary = "Start a mobile social login transaction",
            description =
                    "Validates the registered mobile public client, exact redirect URI, granted"
                            + " scopes, state, and S256 PKCE challenge before starting the"
                            + " configured provider in the same browser session.")
    @ApiResponse(responseCode = "302", description = "Redirects to the configured provider.")
    @ApiResponse(responseCode = "400", description = "The mobile authorization request is invalid.")
    ResponseEntity<Void> startMobileSocialLogin(
            @Parameter(description = "Configured public-login provider alias", example = "google")
                    @PathVariable
                    String provider,
            HttpServletRequest request) {
        try {
            String redirect =
                    mobileSocialLoginTransactionService.begin(
                            provider, singleValueParameters(request), request.getSession(true));
            return ResponseEntity.status(HttpStatus.FOUND).header("Location", redirect).build();
        } catch (IllegalArgumentException _) {
            throw ApiException.badRequest(
                    "authorizationRequest",
                    ApiErrorCode.INVALID_REQUEST,
                    "The mobile social login request is invalid");
        }
    }

    private static Map<String, String> singleValueParameters(HttpServletRequest request) {
        return request.getParameterMap().entrySet().stream()
                .collect(
                        Collectors.toUnmodifiableMap(
                                Map.Entry::getKey,
                                entry -> {
                                    String[] values = entry.getValue();
                                    if (values == null || values.length != 1) {
                                        throw new IllegalArgumentException(
                                                "authorization_request_invalid");
                                    }
                                    return values[0];
                                }));
    }
}
