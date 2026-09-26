package io.github.susimsek.springauthserversamples.config.openapi;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.examples.Example;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
final class OAuth2OidcOpenApiCustomizer implements OpenApiCustomizer {

    private static final String REFRESH_TOKEN = "refresh_token";
    private static final String APPLICATION_JSON = "application/json";

    private final ApplicationProperties applicationProperties;

    @Override
    public void customise(OpenAPI openApi) {
        String issuer = applicationProperties.authorizationServer().issuer();
        Paths paths = openApi.getPaths() == null ? new Paths() : openApi.getPaths();
        paths.addPathItem(
                "/.well-known/openid-configuration",
                jsonGet(
                        "OpenID Provider Configuration",
                        "OpenID Connect Discovery metadata.",
                        Map.of("issuer", issuer, "token_endpoint", issuer + "/oauth2/token")));
        paths.addPathItem(
                "/.well-known/oauth-authorization-server",
                jsonGet(
                        "OAuth 2.0 Authorization Server Metadata",
                        "RFC 8414 server metadata.",
                        Map.of(
                                "issuer",
                                issuer,
                                "grant_types_supported",
                                List.of(
                                        "authorization_code",
                                        REFRESH_TOKEN,
                                        "client_credentials",
                                        AuthorizationGrantTypes.TOKEN_EXCHANGE))));
        paths.addPathItem(
                "/oauth2/jwks",
                jsonGet(
                        "JSON Web Key Set",
                        "Public verification keys.",
                        Map.of("keys", List.of(Map.of("kty", "RSA", "kid", "...", "use", "sig")))));
        paths.addPathItem(
                "/oauth2/authorize",
                get(
                        "Authorization Endpoint",
                        "Starts Authorization Code with PKCE; redirects to login, consent, or the"
                                + " client callback.",
                        "302"));
        paths.addPathItem(
                "/oauth2/token",
                tokenEndpoint(
                        "Token Endpoint",
                        "Exchanges authorization codes, refresh tokens, client credentials, or"
                                + " RFC 8693 subject tokens. Refresh tokens are rotated and cannot"
                                + " be reused."));
        paths.addPathItem(
                "/oauth2/introspect",
                formPost(
                        "Token Introspection Endpoint",
                        "Returns active-token metadata.",
                        "token=eyJraWQiOi...&token_type_hint=access_token",
                        Map.of("active", true, "client_id", "account-console", "sub", "user")));
        paths.addPathItem(
                "/oauth2/revoke",
                formPost(
                        "Token Revocation Endpoint",
                        "Revokes an access or refresh token.",
                        "token=eyJraWQiOi...&token_type_hint=" + REFRESH_TOKEN,
                        null));
        paths.addPathItem(
                "/userinfo",
                jsonGet(
                        "UserInfo Endpoint",
                        "Returns claims for an OIDC access token.",
                        Map.of("sub", "user", "preferred_username", "user", "locale", "tr")));
        paths.addPathItem(
                "/connect/logout",
                get("RP-Initiated Logout Endpoint", "Ends the browser SSO session.", "302"));
        openApi.setPaths(paths);
    }

    private static PathItem get(String summary, String description, String responseCode) {
        return new PathItem().get(operation(summary, description, responseCode));
    }

    private static PathItem jsonGet(String summary, String description, Object example) {
        Operation operation = operation(summary, description, "200");
        operation
                .getResponses()
                .get("200")
                .setContent(
                        new Content()
                                .addMediaType(
                                        APPLICATION_JSON,
                                        new MediaType()
                                                .schema(new ObjectSchema())
                                                .example(example)));
        return new PathItem().get(operation);
    }

    private static PathItem tokenEndpoint(String summary, String description) {
        MediaType form =
                new MediaType()
                        .schema(
                                new ObjectSchema()
                                        .addProperty("grant_type", new StringSchema())
                                        .addProperty("client_id", new StringSchema())
                                        .addProperty("code", new StringSchema())
                                        .addProperty("code_verifier", new StringSchema())
                                        .addProperty(REFRESH_TOKEN, new StringSchema()))
                        .addExamples(
                                "authorizationCode",
                                new Example()
                                        .summary("Authorization Code + PKCE")
                                        .value(
                                                "grant_type=authorization_code&client_id="
                                                    + "account-console&code=...&code_verifier=..."))
                        .addExamples(
                                "refreshToken",
                                new Example()
                                        .summary("Refresh token rotation")
                                        .value(
                                                "grant_type="
                                                        + REFRESH_TOKEN
                                                        + "&client_id=account-console&refresh_token=..."));
        Operation operation =
                operation(summary, description, "200")
                        .requestBody(formRequest("OAuth 2.0 form parameters.", form));
        operation
                .getResponses()
                .get("200")
                .setContent(
                        new Content()
                                .addMediaType(
                                        APPLICATION_JSON,
                                        new MediaType()
                                                .schema(new ObjectSchema())
                                                .example(
                                                        Map.of(
                                                                "access_token",
                                                                "eyJraWQiOi...",
                                                                "token_type",
                                                                "Bearer",
                                                                "expires_in",
                                                                300,
                                                                REFRESH_TOKEN,
                                                                "..."))));
        return new PathItem().post(operation);
    }

    private static PathItem formPost(
            String summary, String description, String exampleValue, Map<String, Object> response) {
        MediaType form =
                new MediaType()
                        .schema(
                                new ObjectSchema()
                                        .addProperty("token", new StringSchema())
                                        .addProperty("token_type_hint", new StringSchema()))
                        .addExamples("request", new Example().value(exampleValue));
        Operation operation =
                operation(summary, description, "200")
                        .requestBody(formRequest("OAuth 2.0 form parameters.", form));
        if (response != null) {
            operation
                    .getResponses()
                    .get("200")
                    .setContent(
                            new Content()
                                    .addMediaType(
                                            APPLICATION_JSON,
                                            new MediaType()
                                                    .schema(new ObjectSchema())
                                                    .example(response)));
        }
        return new PathItem().post(operation);
    }

    private static RequestBody formRequest(String description, MediaType form) {
        return new RequestBody()
                .required(true)
                .description(description)
                .content(new Content().addMediaType("application/x-www-form-urlencoded", form));
    }

    private static Operation operation(String summary, String description, String responseCode) {
        return new Operation()
                .addTagsItem("OAuth2 / OIDC")
                .summary(summary)
                .description(description)
                .responses(
                        new ApiResponses()
                                .addApiResponse(
                                        responseCode,
                                        new ApiResponse().description("Protocol response."))
                                .addApiResponse(
                                        "400",
                                        new ApiResponse()
                                                .description("OAuth 2.0 protocol error.")
                                                .content(
                                                        new Content()
                                                                .addMediaType(
                                                                        APPLICATION_JSON,
                                                                        new MediaType()
                                                                                .schema(
                                                                                        new ObjectSchema())
                                                                                .example(
                                                                                        Map.of(
                                                                                                "error",
                                                                                                "invalid_request",
                                                                                                "error_description",
                                                                                                "The request"
                                                                                                    + " is invalid."))))));
    }
}
