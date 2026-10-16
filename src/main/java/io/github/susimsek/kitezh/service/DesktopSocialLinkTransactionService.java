package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.DesktopSocialLinkTransactionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkCompleteRequestDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkCompleteResponseDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkStartRequestDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkStartResponseDTO;
import io.github.susimsek.kitezh.repository.DesktopSocialLinkTransactionRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DesktopSocialLinkTransactionService {

    public static final String PENDING_SESSION_ATTRIBUTE =
            "desktopSocialLink.pendingAuthorizationToken";
    public static final String CALLBACK_PROTOCOL = "kitezh";
    public static final String CALLBACK_HOST = "social-link";
    public static final String CALLBACK_PATH = "/callback";

    private static final Duration TRANSACTION_TTL = Duration.ofMinutes(5);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final DesktopSocialLinkTransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final SocialLoginService socialLoginService;
    private final SamlLoginService samlLoginService;
    private final ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository;
    private final ObjectProvider<
                    io.github.susimsek.kitezh.config.security
                            .SamlRelyingPartyRegistrationRepository>
            samlRegistrationRepository;

    @Transactional
    public DesktopSocialLinkStartResponseDTO start(
            String username,
            String provider,
            DesktopSocialLinkStartRequestDTO request,
            String baseUrl) {
        String normalizedProvider = normalizeProvider(provider);
        if (!socialLoginService.isProviderEnabled(normalizedProvider)
                || !isProviderAvailable(normalizedProvider)) {
            throw ApiException.notFound("Social provider is not available for desktop linking");
        }
        UserEntity user =
                userRepository
                        .findForLoginUpdate(username)
                        .orElseThrow(() -> ApiException.notFound("Account not found"));
        Instant now = Instant.now();
        String authorizationToken = randomToken();
        DesktopSocialLinkTransactionEntity transaction = new DesktopSocialLinkTransactionEntity();
        transaction.setUser(user);
        transaction.setProvider(normalizedProvider);
        transaction.setAuthorizationTokenHash(hash(authorizationToken));
        transaction.setCodeChallenge(request.codeChallenge());
        transaction.setState(request.state());
        transaction.setCreatedAt(now);
        transaction.setExpiresAt(now.plus(TRANSACTION_TTL));
        transactionRepository.save(transaction);

        String authorizationUrl =
                baseUrl
                        + "/account/social-links/"
                        + encode(normalizedProvider)
                        + "/desktop/authorize?transaction="
                        + encode(authorizationToken);
        return new DesktopSocialLinkStartResponseDTO(
                authorizationUrl, request.state(), transaction.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public DesktopSocialLinkAuthorization authorize(String authorizationToken, String provider) {
        DesktopSocialLinkTransactionEntity transaction =
                findByAuthorizationToken(authorizationToken);
        ensureProvider(transaction, provider);
        ensurePending(transaction);
        return new DesktopSocialLinkAuthorization(transaction.getProvider());
    }

    @Transactional
    public DesktopSocialLinkCompletion completeFromBrowser(
            String authorizationToken, String provider, Authentication authentication) {
        DesktopSocialLinkTransactionEntity transaction =
                findByAuthorizationTokenForUpdate(authorizationToken);
        ensureProvider(transaction, provider);
        ensurePending(transaction);
        if (authentication
                instanceof
                org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
                        oauth2) {
            socialLoginService.linkExisting(transaction.getUser().getUsername(), provider, oauth2);
        } else if (authentication
                instanceof
                org.springframework.security.saml2.provider.service.authentication
                                .Saml2Authentication
                        saml) {
            samlLoginService.linkExisting(transaction.getUser().getUsername(), provider, saml);
        } else {
            throw new IllegalArgumentException("Unsupported social authentication");
        }
        String completionCode = randomToken();
        transaction.setCompletionCodeHash(hash(completionCode));
        transaction.setCompletedAt(Instant.now());
        transactionRepository.save(transaction);
        return new DesktopSocialLinkCompletion(
                transaction.getProvider(), transaction.getState(), completionCode);
    }

    @Transactional
    public DesktopSocialLinkFailure failureFromBrowser(String authorizationToken, String error) {
        DesktopSocialLinkTransactionEntity transaction =
                findByAuthorizationTokenForUpdate(authorizationToken);
        if (transaction.getCompletedAt() != null || transaction.getConsumedAt() != null) {
            return new DesktopSocialLinkFailure(transaction.getState(), "authorization_failed");
        }
        return new DesktopSocialLinkFailure(transaction.getState(), sanitizeError(error));
    }

    @Transactional
    public DesktopSocialLinkCompleteResponseDTO complete(
            String username, DesktopSocialLinkCompleteRequestDTO request) {
        DesktopSocialLinkTransactionEntity transaction =
                transactionRepository
                        .findByCompletionCodeHash(hash(request.code()))
                        .orElseThrow(
                                () ->
                                        ApiException.badRequest(
                                                ApiErrorCode.INVALID_REQUEST,
                                                "Desktop social-link transaction is invalid"));
        if (!Objects.equals(transaction.getUser().getUsername(), username)) {
            throw ApiException.forbidden(
                    ApiErrorCode.FORBIDDEN,
                    "Desktop social-link transaction belongs to another account");
        }
        verifyCodeVerifier(transaction, request.codeVerifier());
        if (transaction.getCompletedAt() == null || isExpired(transaction)) {
            throw ApiException.conflict(
                    ApiErrorCode.CONFLICT, "Desktop social-link transaction has expired");
        }
        if (transaction.getConsumedAt() == null) {
            transaction.setConsumedAt(Instant.now());
            transactionRepository.save(transaction);
        }
        return new DesktopSocialLinkCompleteResponseDTO(transaction.getProvider(), true);
    }

    public String callbackUrl(String state, String code, String error) {
        StringBuilder value =
                new StringBuilder(CALLBACK_PROTOCOL)
                        .append("://")
                        .append(CALLBACK_HOST)
                        .append(CALLBACK_PATH)
                        .append("?state=")
                        .append(encode(state));
        if (code != null) {
            value.append("&code=").append(encode(code));
        }
        if (error != null) {
            value.append("&error=").append(encode(sanitizeError(error)));
        }
        return value.toString();
    }

    private boolean isProviderAvailable(String provider) {
        ClientRegistrationRepository oauth = clientRegistrationRepository.getIfAvailable();
        ClientRegistration registration =
                oauth == null ? null : oauth.findByRegistrationId(provider);
        if (registration != null) {
            return true;
        }
        var saml = samlRegistrationRepository.getIfAvailable();
        return saml != null && saml.findByRegistrationId(provider) != null;
    }

    private DesktopSocialLinkTransactionEntity findByAuthorizationToken(String token) {
        return transactionRepository
                .findByAuthorizationTokenHash(hash(token))
                .orElseThrow(
                        () ->
                                ApiException.badRequest(
                                        ApiErrorCode.INVALID_REQUEST,
                                        "Desktop social-link transaction is invalid"));
    }

    private DesktopSocialLinkTransactionEntity findByAuthorizationTokenForUpdate(String token) {
        return findByAuthorizationToken(token);
    }

    private static void ensureProvider(
            DesktopSocialLinkTransactionEntity transaction, String provider) {
        if (!transaction.getProvider().equals(normalizeProvider(provider))) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Desktop social-link provider does not match");
        }
    }

    private static void ensurePending(DesktopSocialLinkTransactionEntity transaction) {
        if (transaction.getCompletedAt() != null || transaction.getConsumedAt() != null) {
            throw ApiException.conflict(
                    ApiErrorCode.CONFLICT, "Desktop social-link transaction was already used");
        }
        if (isExpired(transaction)) {
            throw ApiException.conflict(
                    ApiErrorCode.CONFLICT, "Desktop social-link transaction has expired");
        }
    }

    private static boolean isExpired(DesktopSocialLinkTransactionEntity transaction) {
        return !transaction.getExpiresAt().isAfter(Instant.now());
    }

    private static void verifyCodeVerifier(
            DesktopSocialLinkTransactionEntity transaction, String verifier) {
        String challenge =
                Base64.getUrlEncoder()
                        .withoutPadding()
                        .encodeToString(sha256(verifier.getBytes(StandardCharsets.US_ASCII)));
        if (!MessageDigest.isEqual(
                challenge.getBytes(StandardCharsets.US_ASCII),
                transaction.getCodeChallenge().getBytes(StandardCharsets.US_ASCII))) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Desktop social-link PKCE verification failed");
        }
    }

    private static String normalizeProvider(String provider) {
        if (provider == null || !provider.matches("[a-z0-9][a-z0-9_-]{0,49}")) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Social provider identifier is invalid");
        }
        return provider;
    }

    private static String randomToken() {
        byte[] value = new byte[32];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private static String hash(String value) {
        return HexFormat.of().formatHex(sha256(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static byte[] sha256(byte[] value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String sanitizeError(String error) {
        return error == null || !error.matches("[a-zA-Z0-9_-]{1,64}")
                ? "authorization_failed"
                : error;
    }

    public record DesktopSocialLinkAuthorization(String provider) {}

    public record DesktopSocialLinkCompletion(String provider, String state, String code) {}

    public record DesktopSocialLinkFailure(String state, String error) {}
}
