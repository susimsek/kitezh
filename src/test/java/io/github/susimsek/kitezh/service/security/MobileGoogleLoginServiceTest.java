package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.MobileGoogleLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginPlatform;
import io.github.susimsek.kitezh.dto.account.MobileLoginResponseDTO;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;

class MobileGoogleLoginServiceTest {

    private SocialLoginService socialLoginService;
    private SocialProviderSettingsService providerSettingsService;
    private ClientRegistrationRepository registrations;
    private JwtDecoderFactory<ClientRegistration> decoderFactory;
    private JwtDecoder decoder;
    private MobileNativeLoginService mobileNativeLoginService;
    private LoginRateLimitService rateLimitService;
    private MobileGoogleLoginService service;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() {
        socialLoginService = mock(SocialLoginService.class);
        providerSettingsService = mock(SocialProviderSettingsService.class);
        registrations = mock(ClientRegistrationRepository.class);
        decoderFactory = mock(JwtDecoderFactory.class);
        decoder = mock(JwtDecoder.class);
        mobileNativeLoginService = mock(MobileNativeLoginService.class);
        rateLimitService = mock(LoginRateLimitService.class);
        servletRequest = mock(HttpServletRequest.class);
        when(servletRequest.getRemoteAddr()).thenReturn("192.0.2.10");
        when(rateLimitService.check("google", "192.0.2.10"))
                .thenReturn(new LoginRateLimitService.RateLimitDecision(true, 10, 9, 60));
        service =
                new MobileGoogleLoginService(
                        socialLoginService,
                        providerSettingsService,
                        registrations,
                        decoderFactory,
                        mobileNativeLoginService,
                        rateLimitService);
    }

    @Test
    void rejectsDisabledGoogleBeforeVerifyingIdToken() {
        when(socialLoginService.mobileLoginRegistrationId("google")).thenReturn("google");
        when(providerSettingsService.provider("google")).thenReturn(providerCredentials(false));
        when(registrations.findByRegistrationId("google")).thenReturn(googleRegistration());

        assertThatThrownBy(() -> service.login(request(), servletRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Native Google login is not configured");

        verify(decoderFactory, never()).createDecoder(any());
        verify(socialLoginService, never()).findOrCreate(any());
        verify(mobileNativeLoginService, never())
                .beginSocialLogin(any(), any(), any(Boolean.class));
    }

    @Test
    void rejectsUnverifiableGoogleIdTokenWithoutCreatingOrAuthenticatingLocalUser() {
        configureEnabledProvider();
        when(decoderFactory.createDecoder(any())).thenReturn(decoder);
        when(decoder.decode("signed-google-id-token"))
                .thenThrow(new IllegalArgumentException("invalid signature"));

        assertThatThrownBy(() -> service.login(request(), servletRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Google authentication failed");

        verify(socialLoginService, never()).findOrCreate(any());
        verify(mobileNativeLoginService, never())
                .beginSocialLogin(any(), any(), any(Boolean.class));
        verify(decoder).decode("signed-google-id-token");
    }

    @Test
    void verifiesGoogleIdTokenBeforeContinuingWithMobilePkce() {
        configureEnabledProvider();
        when(decoderFactory.createDecoder(any())).thenReturn(decoder);
        when(decoder.decode("signed-google-id-token")).thenReturn(verifiedGoogleJwt());
        when(socialLoginService.findOrCreate(any())).thenReturn("social_google_user");
        MobileLoginResponseDTO expected =
                MobileLoginResponseDTO.authorized(
                        "kitezh-code", request().state(), request().redirectUri());
        when(mobileNativeLoginService.beginSocialLogin(any(), any(), any(Boolean.class)))
                .thenReturn(expected);

        MobileLoginResponseDTO result = service.login(request(), servletRequest);

        assertThat(result).isSameAs(expected);
        verify(decoder).decode("signed-google-id-token");
        verify(socialLoginService).findOrCreate(any());
        verify(mobileNativeLoginService).beginSocialLogin(request(), "social_google_user", false);
    }

    @Test
    void rejectsGoogleIdTokenWithWrongAudienceBeforeLocalLogin() {
        configureEnabledProvider();
        when(decoderFactory.createDecoder(any())).thenReturn(decoder);
        when(decoder.decode("signed-google-id-token"))
                .thenReturn(verifiedGoogleJwt("another-client"));

        assertThatThrownBy(() -> service.login(request(), servletRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Google authentication failed");

        verify(socialLoginService, never()).findOrCreate(any());
        verify(mobileNativeLoginService, never())
                .beginSocialLogin(any(), any(), any(Boolean.class));
    }

    private void configureEnabledProvider() {
        when(socialLoginService.mobileLoginRegistrationId("google")).thenReturn("google");
        when(providerSettingsService.provider("google")).thenReturn(providerCredentials(true));
        when(registrations.findByRegistrationId("google")).thenReturn(googleRegistration());
    }

    private static SocialProviderSettingsService.ProviderCredentials providerCredentials(
            boolean enabled) {
        return new SocialProviderSettingsService.ProviderCredentials(
                "google",
                "google",
                "google-client",
                "google-secret",
                enabled,
                false,
                false,
                false,
                false,
                "sub",
                false,
                false,
                0,
                "always");
    }

    private static ClientRegistration googleRegistration() {
        return ClientRegistration.withRegistrationId("google")
                .clientId("google-client")
                .clientSecret("google-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .scope("openid", "profile", "email")
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .tokenUri("https://oauth2.googleapis.com/token")
                .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                .issuerUri("https://accounts.google.com")
                .userNameAttributeName("sub")
                .build();
    }

    private static Jwt verifiedGoogleJwt() {
        return verifiedGoogleJwt("google-client");
    }

    private static Jwt verifiedGoogleJwt(String audience) {
        Instant now = Instant.now();
        return new Jwt(
                "signed-id-token",
                now.minusSeconds(10),
                now.plusSeconds(300),
                Map.of("alg", "RS256"),
                Map.of(
                        "iss", "https://accounts.google.com",
                        "sub", "google-subject",
                        "email", "google@example.test",
                        "email_verified", true,
                        "aud", List.of(audience)));
    }

    private static MobileGoogleLoginRequestDTO request() {
        return new MobileGoogleLoginRequestDTO(
                "mobile-account-console",
                "kitezh://oauth/callback",
                "openid account-api",
                "state_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                "S256",
                "nonce_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                MobileLoginPlatform.ANDROID,
                "signed-google-id-token");
    }
}
