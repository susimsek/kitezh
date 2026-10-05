package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService.ProviderCredentials;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

@SuppressWarnings("java:S5778")
class SocialLoginConfigTest {

    @Test
    void keepsOAuthClientRepositoryUsableBeforeAdminCredentialsAreEntered() {
        assertThat(SocialLoginConfig.registrations(List.of())).isEmpty();
    }

    @Test
    void exposesOidcDecoderFactoryAndReloadableConfiguredRepository() {
        SocialLoginConfig config = new SocialLoginConfig();
        var decoderFactory = config.socialOidcJwtDecoderFactory();
        assertThat(decoderFactory).isNotNull();
        ClientRegistration google =
                ClientRegistration.withRegistrationId("google")
                        .clientId("id")
                        .clientSecret("secret")
                        .authorizationGrantType(
                                org.springframework.security.oauth2.core.AuthorizationGrantType
                                        .AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationUri("https://accounts.google.com/auth")
                        .tokenUri("https://accounts.google.com/token")
                        .jwkSetUri("https://accounts.google.com/jwks")
                        .build();
        assertThat(decoderFactory.createDecoder(google)).isNotNull();
        ClientRegistration microsoft =
                ClientRegistration.withRegistrationId("microsoft")
                        .clientId("id")
                        .clientSecret("secret")
                        .authorizationGrantType(
                                org.springframework.security.oauth2.core.AuthorizationGrantType
                                        .AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationUri("https://login.microsoftonline.com/auth")
                        .tokenUri("https://login.microsoftonline.com/token")
                        .jwkSetUri("https://login.microsoftonline.com/jwks")
                        .issuerUri("https://login.microsoftonline.com/common/v2.0")
                        .build();
        assertThat(decoderFactory.createDecoder(microsoft)).isNotNull();
        ClientRegistration otherIssuer =
                ClientRegistration.withRegistrationId("other")
                        .clientId("id")
                        .clientSecret("secret")
                        .authorizationGrantType(
                                org.springframework.security.oauth2.core.AuthorizationGrantType
                                        .AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationUri("https://issuer.example/authorize")
                        .tokenUri("https://issuer.example/token")
                        .jwkSetUri("https://issuer.example/jwks")
                        .issuerUri("https://issuer.example")
                        .build();
        assertThat(decoderFactory.createDecoder(otherIssuer)).isNotNull();

        SocialProviderSettingsService settingsService =
                Mockito.mock(SocialProviderSettingsService.class);
        whenConfigured(settingsService);

        ReloadableClientRegistrationRepository repository =
                config.socialClientRegistrationRepository(settingsService);

        assertThat(repository.findByRegistrationId("google")).isNotNull();
        assertThat(repository.findByRegistrationId("microsoft")).isNull();
    }

    @Test
    void createsOnlyConfiguredRegistrations() {
        List<ProviderCredentials> providers =
                List.of(
                        new ProviderCredentials("google", "google-id", "google-secret"),
                        new ProviderCredentials("microsoft", "", ""));

        assertThat(SocialLoginConfig.registrations(providers))
                .extracting("registrationId")
                .containsExactly("google");
    }

    @Test
    void createsProviderSpecificRegistrations() {
        List<ProviderCredentials> providers =
                List.of(
                        new ProviderCredentials("github", "github-id", "github-secret"),
                        new ProviderCredentials("linkedin", "linkedin-id", "linkedin-secret"),
                        new ProviderCredentials("microsoft", "microsoft-id", "microsoft-secret"));

        var registrations = SocialLoginConfig.registrations(providers);

        assertThat(registrations)
                .extracting("registrationId")
                .containsExactly("github", "linkedin", "microsoft");
        assertThat(registrations.get(0).getScopes()).containsExactly("read:user", "user:email");
        assertThat(registrations.get(1).getClientAuthenticationMethod())
                .isEqualTo(ClientAuthenticationMethod.CLIENT_SECRET_POST);
        assertThat(registrations.get(1).getClientSettings().isRequireProofKey()).isFalse();
        assertThat(registrations.get(2).getProviderDetails().getIssuerUri())
                .contains("login.microsoftonline.com");
    }

    @Test
    void createsGenericOidcRegistrationWithOptionalMetadata() {
        ProviderCredentials provider =
                new ProviderCredentials(
                        "custom",
                        "custom-alias",
                        "Custom",
                        "oidc",
                        "client-id",
                        "client-secret",
                        true,
                        false,
                        false,
                        false,
                        false,
                        "sub",
                        false,
                        false,
                        1,
                        "always",
                        "https://issuer.example/authorize",
                        "https://issuer.example/token",
                        "https://issuer.example/userinfo",
                        "https://issuer.example/jwks",
                        "https://issuer.example",
                        "client_secret_post",
                        "openid,email",
                        "subject");

        var registration = SocialLoginConfig.registrations(List.of(provider)).getFirst();

        assertThat(registration.getRegistrationId()).isEqualTo("custom-alias");
        assertThat(registration.getClientAuthenticationMethod())
                .isEqualTo(ClientAuthenticationMethod.CLIENT_SECRET_POST);
        assertThat(registration.getScopes()).containsExactly("openid", "email");
        assertThat(registration.getProviderDetails().getJwkSetUri())
                .isEqualTo("https://issuer.example/jwks");
        assertThat(registration.getProviderDetails().getIssuerUri())
                .isEqualTo("https://issuer.example");
        assertThat(
                        registration
                                .getProviderDetails()
                                .getUserInfoEndpoint()
                                .getUserNameAttributeName())
                .isEqualTo("subject");
    }

    @Test
    void rejectsGenericOidcProviderWithoutAuthorizationOrTokenEndpoints() {
        ProviderCredentials missingAuthorization =
                new ProviderCredentials(
                        "custom",
                        "custom",
                        "Custom",
                        "oidc",
                        "id",
                        "secret",
                        true,
                        false,
                        false,
                        false,
                        false,
                        "sub",
                        false,
                        false,
                        0,
                        "always",
                        null,
                        "https://issuer.example/token",
                        null,
                        null,
                        null,
                        "client_secret_basic",
                        "openid",
                        "sub");

        assertThatThrownBy(() -> SocialLoginConfig.registrations(List.of(missingAuthorization)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Authorization and token endpoints are required");

        ProviderCredentials missingToken =
                new ProviderCredentials(
                        "custom",
                        "custom",
                        "Custom",
                        "oidc",
                        "id",
                        "secret",
                        true,
                        false,
                        false,
                        false,
                        false,
                        "sub",
                        false,
                        false,
                        0,
                        "always",
                        "https://issuer.example/authorize",
                        null,
                        null,
                        null,
                        null,
                        "client_secret_basic",
                        "openid",
                        "sub");

        assertThatThrownBy(() -> SocialLoginConfig.registrations(List.of(missingToken)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Authorization and token endpoints are required");
    }

    @Test
    void createsGenericRegistrationWithoutOptionalJwkAndIssuer() {
        ProviderCredentials provider =
                new ProviderCredentials(
                        "custom",
                        "custom",
                        "Custom",
                        "oidc",
                        "id",
                        "secret",
                        true,
                        false,
                        false,
                        false,
                        false,
                        "sub",
                        false,
                        false,
                        0,
                        "always",
                        "https://issuer.example/authorize",
                        "https://issuer.example/token",
                        null,
                        " ",
                        " ",
                        "client_secret_basic",
                        "openid",
                        "sub");

        var registration = SocialLoginConfig.registrations(List.of(provider)).getFirst();

        assertThat(registration.getProviderDetails().getJwkSetUri()).isNull();
        assertThat(registration.getProviderDetails().getIssuerUri()).isNull();
    }

    @Test
    void createsOidcRegistrationsWithProviderDisplayNames() {
        var providers =
                List.of(
                        new ProviderCredentials(
                                "google",
                                "google-alias",
                                "id",
                                "secret",
                                true,
                                false,
                                false,
                                0,
                                "always"),
                        new ProviderCredentials(
                                "microsoft",
                                "microsoft-alias",
                                "id",
                                "secret",
                                true,
                                false,
                                false,
                                0,
                                "always"));

        assertThat(SocialLoginConfig.registrations(providers))
                .extracting("clientName")
                .containsExactly("Google", "Microsoft");
    }

    private static void whenConfigured(SocialProviderSettingsService settingsService) {
        org.mockito.Mockito.when(settingsService.configuredProviders())
                .thenReturn(List.of(new ProviderCredentials("google", "id", "secret")));
    }
}
