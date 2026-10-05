package io.github.susimsek.kitezh.config.openapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.junit.jupiter.api.Test;

class OpenApiConfigTest {

    @Test
    void buildsSharedApiDefinitionAndGroups() {
        OpenApiConfig config = new OpenApiConfig();
        OpenAPI api = config.authorizationServerOpenApi(new ApplicationProperties());

        assertThat(api.getInfo().getTitle()).contains("Kitezh");
        assertThat(api.getServers()).hasSize(1);
        assertThat(api.getComponents().getSecuritySchemes())
                .containsKeys(
                        OpenApiConfig.ADMIN_BEARER,
                        OpenApiConfig.ACCOUNT_BEARER,
                        OpenApiConfig.BROWSER_SESSION);
        assertThat(api.getComponents().getSchemas())
                .containsKeys("OAuth2Error", "JwkSet", "UserInfo");

        ApplicationApiOpenApiCustomizer applicationCustomizer =
                mock(ApplicationApiOpenApiCustomizer.class);
        OAuth2OidcOpenApiCustomizer oauthCustomizer = mock(OAuth2OidcOpenApiCustomizer.class);
        assertThat(config.adminApiOpenApi(applicationCustomizer).getGroup()).isEqualTo("admin-api");
        assertThat(config.accountApiOpenApi(applicationCustomizer).getGroup())
                .isEqualTo("account-api");
        assertThat(config.oauth2OidcOpenApi(oauthCustomizer).getGroup()).isEqualTo("oauth2-oidc");
    }

    @Test
    void documentsPageableParametersAndSuccessExamples() {
        Operation operation =
                new Operation()
                        .responses(
                                new io.swagger.v3.oas.models.responses.ApiResponses()
                                        .addApiResponse("200", new ApiResponse()));
        operation.addParametersItem(new Parameter().name("size").schema(new IntegerSchema()));
        operation.addParametersItem(new Parameter().name("page").schema(new IntegerSchema()));
        operation.addParametersItem(new Parameter().name("sort").schema(new StringSchema()));
        operation.addParametersItem(new Parameter().name("ignored"));

        Paths paths = new Paths();
        paths.addPathItem("/api/account/profile", new PathItem().get(operation));
        paths.addPathItem(
                "/api/admin/clients",
                new PathItem()
                        .get(
                                new Operation()
                                        .responses(
                                                new io.swagger.v3.oas.models.responses
                                                                .ApiResponses()
                                                        .addApiResponse(
                                                                "200",
                                                                new ApiResponse()
                                                                        .content(new Content())))));
        paths.addPathItem("/api/admin/users", new PathItem().get(new Operation()));

        OpenAPI api = new OpenAPI().paths(paths);
        new ApplicationApiOpenApiCustomizer().customise(api);

        Parameter size = operation.getParameters().get(0);
        assertThat(size.getDescription()).contains("1-100");
        assertThat(size.getSchema().getMinimum()).isEqualByComparingTo("1");
        assertThat(size.getSchema().getMaximum()).isEqualByComparingTo("100");
        assertThat(size.getSchema().getExample()).isEqualTo(20);
        assertThat(operation.getParameters().get(1).getDescription()).contains("Zero-based");
        assertThat(operation.getParameters().get(2).getSchema().getExample())
                .isEqualTo("username,asc");
        assertThat(
                        api.getPaths()
                                .get("/api/account/profile")
                                .getGet()
                                .getResponses()
                                .get("200")
                                .getContent()
                                .get("application/json")
                                .getExamples())
                .containsKey("success");
        assertThat(
                        api.getPaths()
                                .get("/api/admin/clients")
                                .getGet()
                                .getResponses()
                                .get("200")
                                .getContent()
                                .get("application/json")
                                .getExamples())
                .containsKey("success");
    }

    @Test
    void toleratesMissingOpenApiParts() {
        ApplicationApiOpenApiCustomizer customizer = new ApplicationApiOpenApiCustomizer();
        assertThatCode(
                        () -> {
                            customizer.customise(new OpenAPI());
                            customizer.customise(
                                    new OpenAPI()
                                            .paths(
                                                    new Paths()
                                                            .addPathItem(
                                                                    "/other", new PathItem())));
                            customizer.customise(
                                    new OpenAPI()
                                            .paths(
                                                    new Paths()
                                                            .addPathItem(
                                                                    "/api/account/profile",
                                                                    new PathItem()
                                                                            .get(
                                                                                    new Operation()))));
                        })
                .doesNotThrowAnyException();
    }

    @Test
    void addsOAuth2AndOidcProtocolDocumentation() {
        OpenAPI api = new OpenAPI();
        new OAuth2OidcOpenApiCustomizer(new ApplicationProperties()).customise(api);

        assertThat(api.getPaths())
                .containsKeys(
                        "/.well-known/openid-configuration",
                        "/.well-known/oauth-authorization-server",
                        "/oauth2/jwks",
                        "/oauth2/authorize",
                        "/oauth2/token",
                        "/oauth2/introspect",
                        "/oauth2/revoke",
                        "/userinfo",
                        "/connect/logout");
        assertThat(api.getPaths().get("/oauth2/token").getPost().getRequestBody().getContent())
                .containsKey("application/x-www-form-urlencoded");
        assertThat(
                        api.getPaths()
                                .get("/oauth2/token")
                                .getPost()
                                .getRequestBody()
                                .getContent()
                                .get("application/x-www-form-urlencoded")
                                .getExamples())
                .containsKeys("authorizationCode", "refreshToken");
        assertThat(api.getPaths().get("/oauth2/introspect").getPost().getResponses()).isNotNull();
    }
}
