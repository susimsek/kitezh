package io.github.susimsek.springauthserversamples.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Application", description = "Application landing and endpoint discovery information.")
public class HomeController {

    @GetMapping("/")
    @Operation(
            summary = "Get application links",
            description = "Returns the main application and OAuth2/OIDC endpoint links.")
    @ApiResponse(
            responseCode = "200",
            description = "Application links returned.",
            content =
                    @Content(
                            schema =
                                    @Schema(
                                            type = "object",
                                            example =
                                                    "{\"application\":\"kitezh\",\"metadata\":\"/.well-known/openid-configuration\",\"jwkSet\":\"/oauth2/jwks\",\"tokenEndpoint\":\"/oauth2/token\",\"authorizationEndpoint\":\"/oauth2/authorize\"}")))
    Map<String, Object> index() {
        return Map.of(
                "application", "kitezh",
                "metadata", "/.well-known/openid-configuration",
                "jwkSet", "/oauth2/jwks",
                "tokenEndpoint", "/oauth2/token",
                "authorizationEndpoint", "/oauth2/authorize");
    }
}
