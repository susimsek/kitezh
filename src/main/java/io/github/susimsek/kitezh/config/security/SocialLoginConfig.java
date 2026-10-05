package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService.ProviderCredentials;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenDecoderFactory;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenValidator;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;
import org.springframework.security.oauth2.jwt.JwtValidators;

@Configuration(proxyBeanMethods = false)
public class SocialLoginConfig {

    private static final String OAUTH2_CALLBACK_URI =
            "{baseUrl}/login/oauth2/code/{registrationId}";

    @Bean
    JwtDecoderFactory<ClientRegistration> socialOidcJwtDecoderFactory() {
        OidcIdTokenDecoderFactory factory = new OidcIdTokenDecoderFactory();
        factory.setJwtValidatorFactory(
                registration ->
                        JwtValidators.createDefaultWithValidators(
                                registration.getProviderDetails().getIssuerUri() != null
                                                && registration
                                                        .getProviderDetails()
                                                        .getIssuerUri()
                                                        .contains("login.microsoftonline.com")
                                        ? new MicrosoftOidcIdTokenValidator(registration)
                                        : new OidcIdTokenValidator(registration)));
        return factory;
    }

    @Bean
    ReloadableClientRegistrationRepository socialClientRegistrationRepository(
            SocialProviderSettingsService providerSettingsService) {
        return new ReloadableClientRegistrationRepository(
                registrations(providerSettingsService.configuredProviders()));
    }

    public static List<ClientRegistration> registrations(List<ProviderCredentials> providers) {
        List<ClientRegistration> registrations = new ArrayList<>();
        providers.forEach(
                provider ->
                        addRegistration(
                                registrations,
                                provider,
                                switch (provider.providerType()) {
                                    case "google" -> SocialLoginConfig::google;
                                    case "github" -> SocialLoginConfig::github;
                                    case "linkedin" -> SocialLoginConfig::linkedin;
                                    case "microsoft" -> SocialLoginConfig::microsoft;
                                    default -> SocialLoginConfig::genericOidc;
                                }));
        return registrations;
    }

    private static ClientRegistration genericOidc(ProviderCredentials provider) {
        if (provider.authorizationUri() == null || provider.tokenUri() == null) {
            throw new IllegalArgumentException("Authorization and token endpoints are required");
        }
        ClientRegistration.Builder builder =
                ClientRegistration.withRegistrationId(provider.alias())
                        .clientId(provider.clientId())
                        .clientSecret(provider.clientSecret())
                        .clientAuthenticationMethod(
                                "client_secret_post".equals(provider.clientAuthenticationMethod())
                                        ? ClientAuthenticationMethod.CLIENT_SECRET_POST
                                        : ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri(OAUTH2_CALLBACK_URI)
                        .scope(provider.scopes().split(","))
                        .authorizationUri(provider.authorizationUri())
                        .tokenUri(provider.tokenUri())
                        .userInfoUri(provider.userInfoUri())
                        .userNameAttributeName(provider.userNameAttribute())
                        .clientName(provider.displayName());
        if (provider.jwkSetUri() != null && !provider.jwkSetUri().isBlank()) {
            builder.jwkSetUri(provider.jwkSetUri());
        }
        if (provider.issuerUri() != null && !provider.issuerUri().isBlank()) {
            builder.issuerUri(provider.issuerUri());
        }
        return builder.build();
    }

    private static void addRegistration(
            List<ClientRegistration> registrations,
            ProviderCredentials provider,
            java.util.function.Function<ProviderCredentials, ClientRegistration> factory) {
        if (provider.configured()) {
            registrations.add(factory.apply(provider));
        }
    }

    private static ClientRegistration google(ProviderCredentials provider) {
        return oidcRegistration(
                provider,
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
                "https://openidconnect.googleapis.com/v1/userinfo",
                "https://www.googleapis.com/oauth2/v3/certs",
                "https://accounts.google.com");
    }

    private static ClientRegistration github(ProviderCredentials provider) {
        return ClientRegistration.withRegistrationId(provider.alias())
                .clientId(provider.clientId())
                .clientSecret(provider.clientSecret())
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(OAUTH2_CALLBACK_URI)
                .scope("read:user", "user:email")
                .authorizationUri("https://github.com/login/oauth/authorize")
                .tokenUri("https://github.com/login/oauth/access_token")
                .userInfoUri("https://api.github.com/user")
                .userNameAttributeName("id")
                .clientName("GitHub")
                .build();
    }

    private static ClientRegistration linkedin(ProviderCredentials provider) {
        return oidcRegistration(
                provider,
                "https://www.linkedin.com/oauth/v2/authorization",
                "https://www.linkedin.com/oauth/v2/accessToken",
                "https://api.linkedin.com/v2/userinfo",
                "https://www.linkedin.com/oauth/openid/jwks",
                "https://www.linkedin.com/oauth",
                ClientAuthenticationMethod.CLIENT_SECRET_POST);
    }

    private static ClientRegistration microsoft(ProviderCredentials provider) {
        return oidcRegistration(
                provider,
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                "https://graph.microsoft.com/oidc/userinfo",
                "https://login.microsoftonline.com/common/discovery/v2.0/keys",
                "https://login.microsoftonline.com/common/v2.0",
                ClientAuthenticationMethod.CLIENT_SECRET_POST);
    }

    private static ClientRegistration oidcRegistration(
            ProviderCredentials provider,
            String authorizationUri,
            String tokenUri,
            String userInfoUri,
            String jwkSetUri,
            String issuerUri) {
        return oidcRegistration(
                provider,
                authorizationUri,
                tokenUri,
                userInfoUri,
                jwkSetUri,
                issuerUri,
                ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
    }

    private static ClientRegistration oidcRegistration(
            ProviderCredentials provider,
            String authorizationUri,
            String tokenUri,
            String userInfoUri,
            String jwkSetUri,
            String issuerUri,
            ClientAuthenticationMethod clientAuthenticationMethod) {
        return ClientRegistration.withRegistrationId(provider.alias())
                .clientId(provider.clientId())
                .clientSecret(provider.clientSecret())
                .clientAuthenticationMethod(clientAuthenticationMethod)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(OAUTH2_CALLBACK_URI)
                .scope("openid", "profile", "email")
                .authorizationUri(authorizationUri)
                .tokenUri(tokenUri)
                .userInfoUri(userInfoUri)
                .jwkSetUri(jwkSetUri)
                .issuerUri(issuerUri)
                .userNameAttributeName("sub")
                .clientSettings(
                        ClientRegistration.ClientSettings.builder()
                                .requireProofKey(!"linkedin".equals(provider.providerType()))
                                .build())
                .clientName(capitalize(provider.registrationId()))
                .build();
    }

    private static String capitalize(String value) {
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }
}
