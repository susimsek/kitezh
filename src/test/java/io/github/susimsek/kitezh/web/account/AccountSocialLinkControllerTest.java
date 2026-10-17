package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkCompleteRequestDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkCompleteResponseDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkStartRequestDTO;
import io.github.susimsek.kitezh.dto.account.DesktopSocialLinkStartResponseDTO;
import io.github.susimsek.kitezh.service.DesktopSocialLinkTransactionService;
import io.github.susimsek.kitezh.service.SocialLoginService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class AccountSocialLinkControllerTest {

    @Test
    void delegatesNativeDesktopAndMobileLinkOperations() {
        var socialLoginService = mock(SocialLoginService.class);
        var transactions = mock(DesktopSocialLinkTransactionService.class);
        var startRequest =
                new DesktopSocialLinkStartRequestDTO(
                        "native-state-value-123", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
        var startResponse =
                new DesktopSocialLinkStartResponseDTO(
                        "https://localhost:9090/authorize",
                        startRequest.state(),
                        Instant.parse("2030-01-01T00:00:00Z"));
        when(transactions.start("alice", "google", startRequest, "https://localhost:9090"))
                .thenReturn(startResponse);
        when(transactions.startMobile("alice", "google", startRequest, "https://localhost:9090"))
                .thenReturn(startResponse);
        var completeRequest =
                new DesktopSocialLinkCompleteRequestDTO(
                        "opaque-completion-code-with-at-least-32-chars",
                        "native-pkce-verifier-with-at-least-43-characters");
        var completeResponse = new DesktopSocialLinkCompleteResponseDTO("google", true);
        when(transactions.complete("alice", completeRequest)).thenReturn(completeResponse);

        var request = new MockHttpServletRequest();
        request.setScheme("https");
        request.setServerName("localhost");
        request.setServerPort(9090);
        request.setRequestURI("/api/account/social-links/google/desktop/start");
        var controller = new AccountSocialLinkController(socialLoginService, transactions);
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated("alice", "ignored", List.of());

        assertThat(controller.startDesktopLink(authentication, "google", startRequest, request))
                .isSameAs(startResponse);
        assertThat(controller.startMobileLink(authentication, "google", startRequest, request))
                .isSameAs(startResponse);
        assertThat(controller.completeDesktopLink(authentication, completeRequest))
                .isSameAs(completeResponse);
        assertThat(controller.completeMobileLink(authentication, completeRequest))
                .isSameAs(completeResponse);

        verify(transactions).start("alice", "google", startRequest, "https://localhost:9090");
        verify(transactions).startMobile("alice", "google", startRequest, "https://localhost:9090");
        verify(transactions, times(2)).complete("alice", completeRequest);
    }
}
