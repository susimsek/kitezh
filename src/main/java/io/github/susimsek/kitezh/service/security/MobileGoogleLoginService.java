package io.github.susimsek.kitezh.service.security;

import io.github.susimsek.kitezh.dto.account.MobileGoogleLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginResponseDTO;
import io.github.susimsek.kitezh.service.SocialAccountLinkRequiredException;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** Verifies Google's native ID token before handing identity into the local login flow. */
@Service
@RequiredArgsConstructor
public class MobileGoogleLoginService {

    private static final String GOOGLE_PROVIDER = "google";
    private static final String GOOGLE_ISSUER = "https://accounts.google.com";

    private final SocialLoginService socialLoginService;
    private final SocialProviderSettingsService providerSettingsService;
    private final ClientRegistrationRepository clientRegistrationRepository;
    private final JwtDecoderFactory<ClientRegistration> jwtDecoderFactory;
    private final MobileNativeLoginService mobileNativeLoginService;
    private final LoginRateLimitService loginRateLimitService;

    public MobileLoginResponseDTO login(
            MobileGoogleLoginRequestDTO request, HttpServletRequest servletRequest) {
        LoginRateLimitService.RateLimitDecision rateLimit =
                loginRateLimitService.check(GOOGLE_PROVIDER, servletRequest.getRemoteAddr());
        if (!rateLimit.allowed()) {
            throw ApiException.tooManyRequests(
                    ApiErrorCode.RATE_LIMIT_EXCEEDED,
                    "Too many login attempts. Please try again later.");
        }

        mobileNativeLoginService.validateSocialLoginRequest(request);
        ClientRegistration registration = googleRegistration();
        Jwt identityToken = verifyIdToken(request.idToken(), registration);
        String username;
        try {
            username =
                    socialLoginService.findOrCreate(
                            new OAuth2AuthenticationToken(
                                    new DefaultOAuth2User(
                                            List.of(new SimpleGrantedAuthority("ROLE_USER")),
                                            identityToken.getClaims(),
                                            "sub"),
                                    List.of(new SimpleGrantedAuthority("ROLE_USER")),
                                    registration.getRegistrationId()));
        } catch (SocialAccountLinkRequiredException _) {
            throw ApiException.conflict(
                    ApiErrorCode.CONFLICT,
                    "Sign in to the existing local account before linking Google.");
        }
        SocialProviderSettingsService.ProviderCredentials providerSettings =
                providerSettingsService.provider(GOOGLE_PROVIDER);
        return mobileNativeLoginService.beginSocialLogin(
                request, username, providerSettings != null && providerSettings.mfaRequired());
    }

    private ClientRegistration googleRegistration() {
        String registrationId;
        try {
            registrationId = socialLoginService.mobileLoginRegistrationId(GOOGLE_PROVIDER);
        } catch (IllegalArgumentException exception) {
            throw providerUnavailable();
        }
        SocialProviderSettingsService.ProviderCredentials settings =
                providerSettingsService.provider(GOOGLE_PROVIDER);
        ClientRegistration registration =
                clientRegistrationRepository.findByRegistrationId(registrationId);
        if (settings == null
                || !GOOGLE_PROVIDER.equalsIgnoreCase(settings.providerType())
                || !settings.enabled()
                || !settings.configured()
                || !StringUtils.hasText(settings.clientSecret())
                || registration == null) {
            throw providerUnavailable();
        }
        return registration;
    }

    private Jwt verifyIdToken(String idToken, ClientRegistration registration) {
        try {
            Jwt token = jwtDecoderFactory.createDecoder(registration).decode(idToken);
            if (!GOOGLE_ISSUER.equals(token.getIssuer().toString())
                    || !token.getAudience().contains(registration.getClientId())
                    || token.getExpiresAt() == null
                    || !token.getExpiresAt().isAfter(Instant.now())
                    || !StringUtils.hasText(token.getSubject())) {
                throw providerAuthenticationFailed();
            }
            return token;
        } catch (RuntimeException exception) {
            throw providerAuthenticationFailed();
        }
    }

    private static ApiException providerUnavailable() {
        return ApiException.badRequest(
                ApiErrorCode.INVALID_REQUEST, "Native Google login is not configured.");
    }

    private static ApiException providerAuthenticationFailed() {
        return ApiException.unauthorized(
                ApiErrorCode.AUTHENTICATION_FAILED, "Google authentication failed.");
    }
}
