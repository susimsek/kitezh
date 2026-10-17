package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.SamlRelyingPartyRegistrationRepository;
import io.github.susimsek.kitezh.service.DesktopSocialLinkTransactionService;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistration;

class SocialAccountLinkControllerTest {

    @Test
    void desktopAuthorizationStoresTransactionAndRedirectsToOauthProvider() throws Exception {
        var oauthProvider = mock(ObjectProvider.class);
        var clientRegistrations = mock(ClientRegistrationRepository.class);
        when(oauthProvider.getIfAvailable()).thenReturn(clientRegistrations);
        var samlRegistrations = mock(SamlRelyingPartyRegistrationRepository.class);
        when(samlRegistrations.findByRegistrationId("google")).thenReturn(null);
        var transactionService = mock(DesktopSocialLinkTransactionService.class);
        when(transactionService.authorize("transaction-1", "google"))
                .thenReturn(
                        new DesktopSocialLinkTransactionService.DesktopSocialLinkAuthorization(
                                "google"));
        var controller =
                new SocialAccountLinkController(
                        oauthProvider,
                        samlRegistrations,
                        mock(SocialLoginService.class),
                        transactionService);
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        controller.desktopAuthorize("google", "transaction-1", request, response);

        HttpSession session = request.getSession(false);
        assertThat(
                        session.getAttribute(
                                DesktopSocialLinkTransactionService.PENDING_SESSION_ATTRIBUTE))
                .isEqualTo("transaction-1");
        assertThat(response.getRedirectedUrl()).isEqualTo("/oauth2/authorization/google");
    }

    @Test
    void mobileAuthorizationReturnsApiFailureStatus() throws Exception {
        var oauthProvider = mock(ObjectProvider.class);
        when(oauthProvider.getIfAvailable()).thenReturn(mock(ClientRegistrationRepository.class));
        var samlRegistrations = mock(SamlRelyingPartyRegistrationRepository.class);
        var transactionService = mock(DesktopSocialLinkTransactionService.class);
        when(transactionService.authorize("expired", "google"))
                .thenThrow(ApiException.conflict(ApiErrorCode.CONFLICT, "Expired"));
        var controller =
                new SocialAccountLinkController(
                        oauthProvider,
                        samlRegistrations,
                        mock(SocialLoginService.class),
                        transactionService);
        var response = new MockHttpServletResponse();

        controller.mobileAuthorize("google", "expired", new MockHttpServletRequest(), response);

        assertThat(response.getStatus()).isEqualTo(409);
    }

    @Test
    void mobileAuthorizationRedirectsToSamlProvider() throws Exception {
        var oauthProvider = mock(ObjectProvider.class);
        when(oauthProvider.getIfAvailable()).thenReturn(mock(ClientRegistrationRepository.class));
        var samlRegistrations = mock(SamlRelyingPartyRegistrationRepository.class);
        when(samlRegistrations.findByRegistrationId("corp-saml"))
                .thenReturn(mock(RelyingPartyRegistration.class));
        var transactionService = mock(DesktopSocialLinkTransactionService.class);
        when(transactionService.authorize("transaction-2", "corp-saml"))
                .thenReturn(
                        new DesktopSocialLinkTransactionService.DesktopSocialLinkAuthorization(
                                "corp-saml"));
        var controller =
                new SocialAccountLinkController(
                        oauthProvider,
                        samlRegistrations,
                        mock(SocialLoginService.class),
                        transactionService);
        var response = new MockHttpServletResponse();

        controller.mobileAuthorize(
                "corp-saml", "transaction-2", new MockHttpServletRequest(), response);

        assertThat(response.getRedirectedUrl()).isEqualTo("/saml2/authenticate/corp-saml");
    }
}
