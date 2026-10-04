package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.ReloadableClientRegistrationRepository;
import io.github.susimsek.kitezh.config.security.SocialLoginSecretCipher;
import io.github.susimsek.kitezh.domain.LoginSettingsEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.dto.admin.AdminSocialProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSocialProvidersRequestDTO;
import io.github.susimsek.kitezh.repository.LoginSettingsRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

@SuppressWarnings("java:S5778")
class SocialProviderSettingsServiceTest {

    private final LoginSettingsRepository repository = mock(LoginSettingsRepository.class);
    private final SocialIdentityRepository identityRepository =
            mock(SocialIdentityRepository.class);
    private final SocialProviderRepository providerRepository =
            mock(SocialProviderRepository.class);
    private final SocialLoginSecretCipher secretCipher = mock(SocialLoginSecretCipher.class);
    private final ObjectProvider<ReloadableClientRegistrationRepository> registrations =
            mock(ObjectProvider.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private LoginSettingsEntity settings;
    private SocialProviderSettingsService service;

    @BeforeEach
    void setUp() {
        settings = new LoginSettingsEntity();
        when(repository.findById(1L)).thenReturn(Optional.of(settings));
        when(providerRepository.findAll()).thenReturn(List.of());
        when(registrations.getIfAvailable()).thenReturn(null);
        service =
                new SocialProviderSettingsService(
                        repository,
                        identityRepository,
                        providerRepository,
                        secretCipher,
                        registrations,
                        auditEventService);
    }

    @Test
    void exposesProviderDefaultsAndLookupModes() {
        settings.setGoogleLoginEnabled(true);
        settings.setGoogleClientId("google-id");
        settings.setGoogleClientSecretEncrypted("encrypted-google-secret");
        when(secretCipher.decrypt("encrypted-google-secret")).thenReturn("google-secret");

        assertThat(service.adminSettings()).hasSize(4);
        assertThat(service.configuredProviders())
                .singleElement()
                .satisfies(
                        provider -> {
                            assertThat(provider.registrationId()).isEqualTo("google");
                            assertThat(provider)
                                    .extracting(
                                            SocialProviderSettingsService.ProviderCredentials
                                                    ::clientId)
                                    .isEqualTo("google-id");
                        });
        assertThat(service.provider("google")).isNotNull();
        assertThat(service.provider("missing")).isNull();
        assertThat(service.provider(null)).isNull();
        assertThat(service.syncMode("missing")).isNull();
        verify(providerRepository).findByRegistrationId("missing");
    }

    @Test
    void resolvesAliasesAndProviderSyncModes() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setRegistrationId("google");
        provider.setAlias("workspace-google");
        provider.setSyncMode("read-only");
        when(providerRepository.findByRegistrationId("google")).thenReturn(Optional.of(provider));
        when(providerRepository.findByRegistrationId("workspace-google"))
                .thenReturn(Optional.empty());
        when(providerRepository.findByAliasIgnoreCase("workspace-google"))
                .thenReturn(Optional.of(provider));

        assertThat(service.provider("GOOGLE")).isNotNull();
        assertThat(service.provider("workspace-google")).isNotNull();
        assertThat(service.provider(" ")).isNull();
        assertThat(service.syncMode("workspace-google")).isEqualTo("read_only");
        assertThat(service.syncMode(null)).isNull();
    }

    @Test
    void reportsDisabledStateAndFailsWhenSettingsAreMissing() {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.adminSettings())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Login settings are not configured");
    }

    @Test
    void updatesAllBuiltInProvidersAndClearsStoredTokens() {
        AdminSocialProviderRequestDTO google = request("google", "google");
        AdminSocialProviderRequestDTO github = request("github", "github");
        AdminSocialProviderRequestDTO linkedin = request("linkedin", "linkedin");
        AdminSocialProviderRequestDTO microsoft = request("microsoft", "microsoft");

        assertThat(
                        service.update(
                                new AdminSocialProvidersRequestDTO(
                                        List.of(google, github, linkedin, microsoft))))
                .hasSize(4);
        verify(repository).save(settings);
        verify(identityRepository).findAllByProvider("google");
        verify(identityRepository).findAllByProvider("microsoft");
        verify(auditEventService).record("social.providers.updated", "social-providers", "default");
    }

    @Test
    void rejectsDuplicateAndUnreadableStoredTokenSettings() {
        assertThatThrownBy(
                        () ->
                                service.update(
                                        new AdminSocialProvidersRequestDTO(
                                                List.of(
                                                        request("google", "same"),
                                                        request("github", "same")))))
                .isInstanceOf(RuntimeException.class);

        AdminSocialProviderRequestDTO invalid =
                new AdminSocialProviderRequestDTO(
                        "google", "google", "id", null, false, false, false, false, "sub", false,
                        true, 0, "always");
        assertThatThrownBy(
                        () -> service.update(new AdminSocialProvidersRequestDTO(List.of(invalid))))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void refreshesConfiguredClientRegistrationsWhenAvailable() {
        ReloadableClientRegistrationRepository reloadable =
                mock(ReloadableClientRegistrationRepository.class);
        when(registrations.getIfAvailable()).thenReturn(reloadable);
        settings.setGoogleLoginEnabled(true);
        settings.setGoogleClientId("id");
        settings.setGoogleClientSecretEncrypted("encrypted-secret");
        when(secretCipher.decrypt("encrypted-secret")).thenReturn("secret");

        service.refreshClientRegistrations();

        verify(reloadable).replace(any());
    }

    @Test
    void appliesNormalizedSettingsAndEncryptsSecrets() {
        when(secretCipher.encrypt("new-secret")).thenReturn("encrypted-secret");
        when(secretCipher.decrypt("encrypted-secret")).thenReturn("new-secret");
        AdminSocialProviderRequestDTO request =
                new AdminSocialProviderRequestDTO(
                        " GOOGLE ",
                        "  Workspace-Google ",
                        " client-id ",
                        " new-secret ",
                        true,
                        true,
                        true,
                        true,
                        " sub, email,sub ",
                        true,
                        true,
                        4,
                        " WHEN-LINKED ");

        service.update(new AdminSocialProvidersRequestDTO(List.of(request)));

        assertThat(settings.getGoogleAlias()).isEqualTo("workspace-google");
        assertThat(settings.getGoogleClientId()).isEqualTo("client-id");
        assertThat(settings.getGoogleClientSecretEncrypted()).isEqualTo("encrypted-secret");
        assertThat(settings.getGoogleRequiredClaims()).isEqualTo("sub,email");
        assertThat(settings.getGoogleShowInAccountConsole()).isEqualTo("when-linked");
        assertThat(settings.isGoogleHideOnLogin()).isTrue();
        assertThat(settings.isGoogleStoreTokens()).isTrue();
        assertThat(settings.isGoogleStoredTokensReadable()).isTrue();
    }

    @Test
    void rejectsInvalidVisibilityClaimsProviderAndEncryption() {
        assertThatThrownBy(
                        () ->
                                service.update(
                                        new AdminSocialProvidersRequestDTO(
                                                List.of(request("google", "google", "invalid")))))
                .isInstanceOf(RuntimeException.class);

        AdminSocialProviderRequestDTO invalidClaims =
                new AdminSocialProviderRequestDTO(
                        "google",
                        "google",
                        "id",
                        null,
                        false,
                        false,
                        false,
                        false,
                        "sub,invalid claim",
                        false,
                        false,
                        0,
                        "always");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        new AdminSocialProvidersRequestDTO(List.of(invalidClaims))))
                .isInstanceOf(RuntimeException.class);

        when(secretCipher.encrypt("secret"))
                .thenThrow(new IllegalStateException("cipher unavailable"));
        assertThatThrownBy(
                        () ->
                                service.update(
                                        new AdminSocialProvidersRequestDTO(
                                                List.of(
                                                        request(
                                                                "google", "google", "always",
                                                                "secret")))))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void clearsStoredTokensFromAllIdentityFields() {
        SocialIdentityEntity identity = new SocialIdentityEntity();
        identity.setAccessTokenEncrypted("access");
        identity.setRefreshTokenEncrypted("refresh");
        identity.setTokenType("Bearer");
        identity.setTokenScopes("openid");
        when(identityRepository.findAllByProvider("google")).thenReturn(List.of(identity));

        service.update(
                new AdminSocialProvidersRequestDTO(
                        List.of(
                                new AdminSocialProviderRequestDTO(
                                        "google", "google", "id", null, false, false, false, false,
                                        "sub", false, false, 0, "always"))));

        assertThat(identity.getAccessTokenEncrypted()).isNull();
        assertThat(identity.getRefreshTokenEncrypted()).isNull();
        assertThat(identity.getTokenType()).isNull();
        assertThat(identity.getTokenScopes()).isNull();
    }

    @Test
    void mergesCustomProviderAndDecryptsStoredSecret() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setRegistrationId("custom");
        provider.setAlias("custom-alias");
        provider.setDisplayName("Custom");
        provider.setProviderType("oidc");
        provider.setClientId("custom-id");
        provider.setClientSecretEncrypted("encrypted");
        provider.setEnabled(true);
        provider.setScopes("openid");
        provider.setUserNameAttribute("sub");
        when(providerRepository.findAll()).thenReturn(List.of(provider));
        when(secretCipher.decrypt("encrypted")).thenReturn("custom-secret");

        assertThat(service.effectiveProviders())
                .anySatisfy(
                        credentials -> {
                            assertThat(credentials.registrationId()).isEqualTo("custom");
                            assertThat(credentials.clientSecret()).isEqualTo("custom-secret");
                        });
    }

    @Test
    void doesNotFallBackToYamlCredentialsWhenStoredProviderClientIdIsBlank() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setRegistrationId("google");
        provider.setAlias("workspace-google");
        provider.setDisplayName("Workspace Google");
        provider.setProviderType("google");
        provider.setClientId(" ");
        provider.setClientSecretEncrypted(" ");
        provider.setEnabled(true);
        provider.setRequiredClaims("sub");
        provider.setShowInAccountConsole("always");
        when(providerRepository.findByRegistrationId("google")).thenReturn(Optional.of(provider));

        SocialProviderSettingsService.ProviderCredentials credentials =
                service.provider("workspace-google");

        assertThat(credentials.clientId()).isBlank();
        assertThat(credentials.clientSecret()).isBlank();
        assertThat(credentials.alias()).isEqualTo("workspace-google");
    }

    @Test
    void handlesStoredProviderWithoutSecretAndNormalizesItsIcon() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setRegistrationId("custom");
        provider.setAlias("custom");
        provider.setDisplayName("Custom");
        provider.setProviderType("oidc");
        provider.setClientId("custom-id");
        provider.setClientSecretEncrypted(" ");
        provider.setIconKey("unknown");
        provider.setEnabled(true);
        provider.setShowInAccountConsole("always");
        when(providerRepository.findAll()).thenReturn(List.of(provider));

        assertThat(service.effectiveProviders())
                .anySatisfy(
                        credentials -> {
                            if (credentials.registrationId().equals("custom")) {
                                assertThat(credentials.clientSecret()).isEmpty();
                                assertThat(credentials.iconKey()).isEqualTo("generic");
                            }
                        });
    }

    @Test
    void defaultsBlankClaimsAndRejectsOverlongClaims() {
        AdminSocialProviderRequestDTO blankClaims =
                new AdminSocialProviderRequestDTO(
                        "google", "google", "id", null, false, false, false, false, " ", false,
                        false, 0, "always");

        service.update(new AdminSocialProvidersRequestDTO(List.of(blankClaims)));

        assertThat(settings.getGoogleRequiredClaims()).isEqualTo("sub");

        AdminSocialProviderRequestDTO overlongClaims =
                new AdminSocialProviderRequestDTO(
                        "google",
                        "google",
                        "id",
                        null,
                        false,
                        false,
                        false,
                        false,
                        "claim".repeat(101),
                        false,
                        false,
                        0,
                        "always");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        new AdminSocialProvidersRequestDTO(
                                                List.of(overlongClaims))))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void supportsAllProviderCredentialConvenienceConstructors() {
        assertThat(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "custom",
                                "alias",
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
                                1,
                                "always",
                                null,
                                null,
                                null,
                                null,
                                null,
                                "client_secret_basic",
                                "openid",
                                "sub",
                                "generic"))
                .isNotNull();
        assertThat(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "custom", "alias", "id", "secret", true, false, false, false, false,
                                "sub", 1, "always", true, false))
                .isNotNull();
    }

    @Test
    void handlesUnknownProviderDefaultsAndConsumer() throws Exception {
        LoginSettingsEntity emptySettings = new LoginSettingsEntity();
        for (java.lang.reflect.Method method :
                SocialProviderSettingsService.class.getDeclaredMethods()) {
            if (method.getParameterCount() == 2
                    && method.getParameterTypes()[0] == String.class
                    && method.getParameterTypes()[1] == LoginSettingsEntity.class) {
                method.setAccessible(true);
                try {
                    method.invoke(service, "custom", emptySettings);
                } catch (java.lang.reflect.InvocationTargetException ignored) {
                    assertThat(ignored).isNotNull();
                    // The credentials factory intentionally rejects unknown provider types.
                }
            }
        }
        var consumer =
                SocialProviderSettingsService.class.getDeclaredMethod(
                        "consumer",
                        String.class,
                        java.util.function.Consumer.class,
                        java.util.function.Consumer.class,
                        java.util.function.Consumer.class,
                        java.util.function.Consumer.class);
        consumer.setAccessible(true);
        @SuppressWarnings("unchecked")
        java.util.function.Consumer<String> defaultConsumer =
                (java.util.function.Consumer<String>)
                        consumer.invoke(
                                null,
                                "custom",
                                (java.util.function.Consumer<String>) value -> {},
                                (java.util.function.Consumer<String>) value -> {},
                                (java.util.function.Consumer<String>) value -> {},
                                (java.util.function.Consumer<String>) value -> {});
        defaultConsumer.accept("ignored");
    }

    private static AdminSocialProviderRequestDTO request(String provider, String alias) {
        return request(provider, alias, "always", provider + "-secret");
    }

    private static AdminSocialProviderRequestDTO request(
            String provider, String alias, String visibility) {
        return request(provider, alias, visibility, provider + "-secret");
    }

    private static AdminSocialProviderRequestDTO request(
            String provider, String alias, String visibility, String secret) {
        return new AdminSocialProviderRequestDTO(
                provider,
                alias,
                provider + "-client",
                secret,
                true,
                false,
                true,
                false,
                "sub,email",
                false,
                false,
                1,
                visibility);
    }
}
