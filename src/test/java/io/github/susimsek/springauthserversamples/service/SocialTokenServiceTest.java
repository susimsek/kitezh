package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.config.security.SocialLoginSecretCipher;
import io.github.susimsek.springauthserversamples.domain.SocialIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.SocialIdentityRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;

@ExtendWith(MockitoExtension.class)
class SocialTokenServiceTest {

    private static final Instant ISSUED_AT = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant EXPIRES_AT = Instant.parse("2026-01-01T01:00:00Z");

    @Mock private SocialIdentityRepository socialIdentityRepository;
    @Mock private SocialProviderSettingsService providerSettingsService;
    @Mock private SocialLoginSecretCipher secretCipher;
    @Mock private OAuth2AuthorizedClient authorizedClient;

    private SocialIdentityEntity identity;

    @BeforeEach
    void setUp() {
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        identity = new SocialIdentityEntity("google", "provider-subject", user);
        lenient()
                .when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "google"))
                .thenReturn(List.of(identity));
        when(providerSettingsService.provider("google")).thenReturn(credentials(true, true));
    }

    @Test
    void encryptsAndStoresProviderTokensAndReadsThemThroughTheAccountService() {
        OAuth2AccessToken accessToken =
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        "access-token",
                        ISSUED_AT,
                        EXPIRES_AT,
                        java.util.Set.of("openid", "profile"));
        OAuth2RefreshToken refreshToken = new OAuth2RefreshToken("refresh-token", ISSUED_AT);
        when(authorizedClient.getAccessToken()).thenReturn(accessToken);
        when(authorizedClient.getRefreshToken()).thenReturn(refreshToken);
        when(secretCipher.encrypt("access-token")).thenReturn("enc-access");
        when(secretCipher.encrypt("refresh-token")).thenReturn("enc-refresh");
        when(secretCipher.decrypt("enc-access")).thenReturn("access-token");
        when(secretCipher.decrypt("enc-refresh")).thenReturn("refresh-token");

        SocialTokenService service = service();
        service.store("ada", "google", authorizedClient);

        assertThat(identity.getAccessTokenEncrypted()).isEqualTo("enc-access");
        assertThat(identity.getRefreshTokenEncrypted()).isEqualTo("enc-refresh");
        assertThat(identity.getAccessTokenExpiresAt()).isEqualTo(EXPIRES_AT);
        assertThat(identity.getTokenType()).isEqualTo("Bearer");
        assertThat(identity.getTokenScopes()).isEqualTo("openid profile");
        verify(socialIdentityRepository).save(identity);

        var token = service.read("ada", "google");
        assertThat(token.provider()).isEqualTo("google");
        assertThat(token.accessToken()).isEqualTo("access-token");
        assertThat(token.refreshToken()).isEqualTo("refresh-token");
        assertThat(token.expiresAt()).isEqualTo(EXPIRES_AT);
        assertThat(token.scopes()).isEqualTo("openid profile");
    }

    @Test
    void clearsPreviouslyStoredTokensWhenStorageIsDisabled() {
        identity.setAccessTokenEncrypted("old-access");
        identity.setRefreshTokenEncrypted("old-refresh");
        identity.setAccessTokenExpiresAt(EXPIRES_AT);
        identity.setTokenType("Bearer");
        identity.setTokenScopes("openid");
        when(providerSettingsService.provider("google")).thenReturn(credentials(false, false));

        service().store("ada", "google", authorizedClient);

        assertThat(identity.getAccessTokenEncrypted()).isNull();
        assertThat(identity.getRefreshTokenEncrypted()).isNull();
        assertThat(identity.getAccessTokenExpiresAt()).isNull();
        assertThat(identity.getTokenType()).isNull();
        assertThat(identity.getTokenScopes()).isNull();
        verify(secretCipher, never()).encrypt(anyString());
    }

    @Test
    void rejectsReadingTokensUnlessTheProviderAllowsIt() {
        when(providerSettingsService.provider("google")).thenReturn(credentials(true, false));

        assertThatThrownBy(() -> service().read("ada", "google"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not readable");
    }

    @Test
    void ignoresMissingClientsProvidersAndAccessTokens() {
        SocialTokenService service = service();
        service.store("ada", "google", null);
        when(providerSettingsService.provider("unknown")).thenReturn(null);
        service.store("ada", "unknown", authorizedClient);

        when(authorizedClient.getAccessToken()).thenReturn(null);
        service.store("ada", "google", authorizedClient);

        assertThat(identity.getAccessTokenEncrypted()).isNull();
        verify(socialIdentityRepository).save(identity);
    }

    @Test
    void storesAccessTokenWithoutOptionalRefreshFields() {
        OAuth2AccessToken accessToken =
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER, "access-token", ISSUED_AT, null, null);
        when(authorizedClient.getAccessToken()).thenReturn(accessToken);
        when(authorizedClient.getRefreshToken()).thenReturn(null);
        when(secretCipher.encrypt("access-token")).thenReturn("enc-access");

        service().store("ada", "google", authorizedClient);

        assertThat(identity.getRefreshTokenEncrypted()).isNull();
        assertThat(identity.getTokenScopes()).isEmpty();
    }

    @Test
    void reportsMissingProviderIdentityAndCipherFailures() {
        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "google"))
                .thenReturn(List.of());
        assertThatThrownBy(() -> service().read("ada", "google"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not linked");

        when(socialIdentityRepository.findAllByUserUsernameAndProvider("ada", "google"))
                .thenReturn(List.of(identity));
        identity.setAccessTokenEncrypted(null);
        assertThatThrownBy(() -> service().read("ada", "google"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("No stored token");

        identity.setAccessTokenEncrypted("broken");
        when(secretCipher.decrypt("broken")).thenThrow(new IllegalStateException("broken cipher"));
        assertThatThrownBy(() -> service().read("ada", "google"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("could not be read");
    }

    private SocialTokenService service() {
        return new SocialTokenService(
                socialIdentityRepository, providerSettingsService, secretCipher);
    }

    private static SocialProviderSettingsService.ProviderCredentials credentials(
            boolean storeTokens, boolean storedTokensReadable) {
        return new SocialProviderSettingsService.ProviderCredentials(
                "google",
                "google",
                "client-id",
                "client-secret",
                true,
                false,
                false,
                storeTokens,
                storedTokensReadable,
                10,
                "always");
    }
}
