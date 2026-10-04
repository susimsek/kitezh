package io.github.susimsek.springauthserversamples.config.openapi;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.security.SecurityScheme.Type;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI groups and shared authentication schemes. Endpoint contracts live on controllers. */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

    public static final String ADMIN_BEARER = "adminBearer";
    public static final String ACCOUNT_BEARER = "accountBearer";
    public static final String BROWSER_SESSION = "browserSession";

    @Bean
    OpenAPI authorizationServerOpenApi(ApplicationProperties applicationProperties) {
        String issuer = applicationProperties.authorizationServer().issuer();
        return new OpenAPI()
                .info(
                        new Info()
                                .title("Kitezh Sample API")
                                .version("v1")
                                .description(
                                        "OAuth 2.1 / OpenID Connect provider with Keycloak-style"
                                                + " Administration and Account APIs.")
                                .license(new License().name("Apache-2.0")))
                .servers(List.of(new Server().url(issuer).description("Configured issuer")))
                .components(
                        new Components()
                                .addSecuritySchemes(
                                        ADMIN_BEARER,
                                        bearerScheme(
                                                "Access token with the `admin-api` scope and the"
                                                        + " required administrative authority."))
                                .addSecuritySchemes(
                                        ACCOUNT_BEARER,
                                        bearerScheme("Access token with the `account-api` scope."))
                                .addSecuritySchemes(
                                        BROWSER_SESSION,
                                        new SecurityScheme()
                                                .type(Type.APIKEY)
                                                .in(SecurityScheme.In.COOKIE)
                                                .name("SESSION")
                                                .description(
                                                        "Authenticated browser session cookie."))
                                .addSchemas(
                                        "OAuth2Error",
                                        new ObjectSchema()
                                                .addProperty("error", new StringSchema())
                                                .addProperty(
                                                        "error_description", new StringSchema())
                                                .addProperty("error_uri", new StringSchema()))
                                .addSchemas(
                                        "JwkSet",
                                        new ObjectSchema().addProperty("keys", new ObjectSchema()))
                                .addSchemas(
                                        "UserInfo",
                                        new ObjectSchema()
                                                .addProperty("sub", new StringSchema())
                                                .addProperty("name", new StringSchema())
                                                .addProperty("email", new StringSchema())
                                                .addProperty("locale", new StringSchema())));
    }

    @Bean
    GroupedOpenApi adminApiOpenApi(ApplicationApiOpenApiCustomizer customizer) {
        return GroupedOpenApi.builder()
                .group("admin-api")
                .displayName("Administration API")
                .pathsToMatch("/api/admin/**")
                .addOpenApiCustomizer(customizer)
                .build();
    }

    @Bean
    GroupedOpenApi accountApiOpenApi(ApplicationApiOpenApiCustomizer customizer) {
        return GroupedOpenApi.builder()
                .group("account-api")
                .displayName("Account API")
                .pathsToMatch("/api/account/**")
                .addOpenApiCustomizer(customizer)
                .build();
    }

    @Bean
    GroupedOpenApi oauth2OidcOpenApi(OAuth2OidcOpenApiCustomizer customizer) {
        return GroupedOpenApi.builder()
                .group("oauth2-oidc")
                .displayName("OAuth2 and OpenID Connect")
                .pathsToMatch(
                        "/.well-known/**", "/oauth2/**", "/userinfo", "/connect/**", "/oidc/**")
                .addOpenApiCustomizer(customizer)
                .build();
    }

    private static SecurityScheme bearerScheme(String description) {
        return new SecurityScheme()
                .type(Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description(description);
    }
}
