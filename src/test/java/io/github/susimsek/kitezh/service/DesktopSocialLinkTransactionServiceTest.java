package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.SamlRelyingPartyRegistrationRepository;
import io.github.susimsek.kitezh.domain.DesktopSocialLinkTransactionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkCompleteRequestDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkStartRequestDTO;
import io.github.susimsek.kitezh.repository.DesktopSocialLinkTransactionRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;

@ExtendWith(MockitoExtension.class)
class DesktopSocialLinkTransactionServiceTest {

    private static final String VERIFIER = "0123456789012345678901234567890123456789012";
    private static final String STATE = "desktop-callback-correlation-state";

    @Mock private DesktopSocialLinkTransactionRepository transactionRepository;
    @Mock private UserRepository userRepository;
    @Mock private SocialLoginService socialLoginService;
    @Mock private SamlLoginService samlLoginService;
    @Mock private ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository;
    @Mock private ClientRegistrationRepository githubClientRegistrationRepository;
    @Mock private ObjectProvider<SamlRelyingPartyRegistrationRepository> samlRegistrationRepository;
    private DesktopSocialLinkTransactionService service;

    @BeforeEach
    void setUp() {
        service =
                new DesktopSocialLinkTransactionService(
                        transactionRepository,
                        userRepository,
                        socialLoginService,
                        samlLoginService,
                        clientRegistrationRepository,
                        samlRegistrationRepository);
    }

    @Test
    void startsAndAuthorizesAnAvailableProviderTransaction() {
        when(socialLoginService.isProviderEnabled("github")).thenReturn(true);
        when(clientRegistrationRepository.getIfAvailable())
                .thenReturn(githubClientRegistrationRepository);
        when(githubClientRegistrationRepository.findByRegistrationId("github"))
                .thenReturn(registration());
        var user = new UserEntity();
        user.setUsername("ada");
        when(userRepository.findForLoginUpdate("ada")).thenReturn(Optional.of(user));
        ArgumentCaptor<DesktopSocialLinkTransactionEntity> saved =
                ArgumentCaptor.forClass(DesktopSocialLinkTransactionEntity.class);
        when(transactionRepository.save(saved.capture()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        String challenge = challenge(VERIFIER);

        var response =
                service.start(
                        "ada",
                        "github",
                        new DesktopSocialLinkStartRequestDTO(STATE, challenge),
                        "https://kitezh.example");

        assertThat(response.state()).isEqualTo(STATE);
        assertThat(response.authorizationUrl())
                .startsWith(
                        "https://kitezh.example/account/social-links/github/desktop/authorize?transaction=");
        var transaction = saved.getValue();
        assertThat(transaction.getAuthorizationTokenHash()).hasSize(64);
        assertThat(transaction.getCodeChallenge()).isEqualTo(challenge);
        assertThat(transaction.getExpiresAt()).isAfter(transaction.getCreatedAt());
        String token =
                URLDecoder.decode(
                        response.authorizationUrl()
                                .substring(
                                        response.authorizationUrl().indexOf("transaction=") + 12),
                        StandardCharsets.UTF_8);
        when(transactionRepository.findByAuthorizationTokenHash(
                        transaction.getAuthorizationTokenHash()))
                .thenReturn(Optional.of(transaction));
        assertThat(service.authorize(token, "github").provider()).isEqualTo("github");
    }

    @Test
    void rejectsUnavailableInvalidAndMissingProviderTransactions() {
        when(socialLoginService.isProviderEnabled("github")).thenReturn(false);
        assertThatThrownBy(
                        () ->
                                service.start(
                                        "ada",
                                        "github",
                                        new DesktopSocialLinkStartRequestDTO(
                                                STATE, challenge(VERIFIER)),
                                        "https://kitezh.example"))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(
                        () ->
                                service.start(
                                        "ada",
                                        "bad/provider",
                                        new DesktopSocialLinkStartRequestDTO(
                                                STATE, challenge(VERIFIER)),
                                        "https://kitezh.example"))
                .isInstanceOf(RuntimeException.class);
        verify(transactionRepository, never()).save(any());
        verify(clientRegistrationRepository, never()).getIfAvailable();
    }

    @Test
    void buildsSafeCallbackUrlsAndSanitizesProviderErrors() {
        assertThat(service.callbackUrl("state value", "code/with+chars", null))
                .isEqualTo(
                        "kitezh://social-link/callback?state=state+value&code=code%2Fwith%2Bchars");
        assertThat(service.callbackUrl("state", null, "access_denied"))
                .isEqualTo("kitezh://social-link/callback?state=state&error=access_denied");
        assertThat(service.callbackUrl("state", null, "token=secret"))
                .isEqualTo("kitezh://social-link/callback?state=state&error=authorization_failed");
    }

    @Test
    void rejectsUnsupportedBrowserAuthenticationAndSanitizesFailureState() {
        var transaction = pendingTransaction();
        when(transactionRepository.findByAuthorizationTokenHash(anyString()))
                .thenReturn(Optional.of(transaction));
        assertThatThrownBy(
                        () ->
                                service.completeFromBrowser(
                                        "opaque-token",
                                        "github",
                                        new UsernamePasswordAuthenticationToken("ada", "x")))
                .isInstanceOf(IllegalArgumentException.class);
        var failure = service.failureFromBrowser("opaque-token", "redirect_uri=https://secret");
        assertThat(failure.state()).isEqualTo(STATE);
        assertThat(failure.error()).isEqualTo("authorization_failed");
    }

    @Test
    void completesPkceHandoffOnlyForOwnerAndConsumesItOnce() throws Exception {
        var transaction = pendingTransaction();
        transaction.setCompletionCodeHash(sha256("opaque-completion-code"));
        transaction.setCompletedAt(java.time.Instant.now());
        when(transactionRepository.findByCompletionCodeHash(transaction.getCompletionCodeHash()))
                .thenReturn(Optional.of(transaction));
        var request = new DesktopSocialLinkCompleteRequestDTO("opaque-completion-code", VERIFIER);

        var result = service.complete("ada", request);

        assertThat(result.provider()).isEqualTo("github");
        assertThat(result.linked()).isTrue();
        assertThat(transaction.getConsumedAt()).isNotNull();
        verify(transactionRepository).save(transaction);
        assertThatThrownBy(() -> service.complete("other", request))
                .isInstanceOf(RuntimeException.class);
    }

    private static DesktopSocialLinkTransactionEntity pendingTransaction() {
        UserEntity user = new UserEntity();
        user.setUsername("ada");
        var transaction = new DesktopSocialLinkTransactionEntity();
        transaction.setUser(user);
        transaction.setProvider("github");
        transaction.setState(STATE);
        transaction.setCodeChallenge(challenge(VERIFIER));
        transaction.setCreatedAt(java.time.Instant.now());
        transaction.setExpiresAt(java.time.Instant.now().plusSeconds(300));
        return transaction;
    }

    private static ClientRegistration registration() {
        return ClientRegistration.withRegistrationId("github")
                .clientId("client")
                .clientSecret("secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .authorizationUri("https://github.example/authorize")
                .tokenUri("https://github.example/token")
                .userInfoUri("https://github.example/user")
                .userNameAttributeName("id")
                .clientName("GitHub")
                .build();
    }

    private static String challenge(String verifier) {
        try {
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
