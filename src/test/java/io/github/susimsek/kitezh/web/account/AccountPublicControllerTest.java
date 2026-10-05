package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.AccountRegistrationRequestDTO;
import io.github.susimsek.kitezh.dto.account.ActionTokenRequestDTO;
import io.github.susimsek.kitezh.dto.account.ForgotPasswordRequestDTO;
import io.github.susimsek.kitezh.dto.account.LoginSettingsDTO;
import io.github.susimsek.kitezh.dto.account.ResetPasswordRequestDTO;
import io.github.susimsek.kitezh.dto.account.SocialLinkDTO;
import io.github.susimsek.kitezh.dto.account.SocialProviderDTO;
import io.github.susimsek.kitezh.dto.account.SocialProviderTokenDTO;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialTokenService;
import io.github.susimsek.kitezh.service.account.AccountRegistrationService;
import io.github.susimsek.kitezh.service.account.UserActionService;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.RegistrationCaptchaService;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;

@SuppressWarnings("java:S5778")
class AccountPublicControllerTest {

    @Test
    void handlesAccountActionsAndFeatureSwitches() {
        var userActionService = mock(UserActionService.class);
        var registrationService = mock(AccountRegistrationService.class);
        var settings = mock(LoginSettingsService.class);
        var captchaService = mock(RegistrationCaptchaService.class);
        var controller =
                new AccountActionController(
                        userActionService, registrationService, settings, captchaService);
        var registration = mock(AccountRegistrationRequestDTO.class);
        when(registration.username()).thenReturn("alice");
        when(registration.firstName()).thenReturn("Alice");
        when(registration.lastName()).thenReturn("User");
        when(registration.email()).thenReturn("alice@example.test");
        when(registration.password()).thenReturn("password");
        when(registration.confirmPassword()).thenReturn("password");
        when(registration.locale()).thenReturn("tr");
        when(settings.isUserRegistrationEnabled()).thenReturn(true);
        assertThat(
                        controller
                                .register(
                                        registration, new MockHttpServletRequest(), Locale.ENGLISH)
                                .getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        verify(registrationService)
                .register(
                        "alice",
                        "Alice",
                        "User",
                        "alice@example.test",
                        "password",
                        "password",
                        Locale.forLanguageTag("tr"));

        var forgot = mock(ForgotPasswordRequestDTO.class);
        when(forgot.identifier()).thenReturn("alice");
        when(forgot.locale()).thenReturn(null);
        when(settings.isForgotPasswordEnabled()).thenReturn(true);
        assertThat(controller.forgotPassword(forgot).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(userActionService).forgotPassword("alice", Locale.ENGLISH);

        var token = mock(ActionTokenRequestDTO.class);
        when(token.token()).thenReturn("token");
        controller.verifyEmail(token);
        controller.confirmEmail(token);
        var reset = mock(ResetPasswordRequestDTO.class);
        when(reset.token()).thenReturn("token");
        when(reset.newPassword()).thenReturn("new-password");
        when(reset.otpCode()).thenReturn("123456");
        controller.resetPassword(reset);
        verify(userActionService).verifyEmail("token");
        verify(userActionService).confirmEmailChange("token");
        verify(userActionService).resetPassword("token", "new-password", "123456");

        when(settings.isUserRegistrationEnabled()).thenReturn(false);
        assertThatThrownBy(
                        () ->
                                controller.register(
                                        registration, new MockHttpServletRequest(), Locale.ENGLISH))
                .isInstanceOf(ApiException.class);
        when(settings.isForgotPasswordEnabled()).thenReturn(false);
        assertThatThrownBy(() -> controller.forgotPassword(forgot))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void delegatesPublicAndAccountSocialControllers() throws Exception {
        var loginSettings = mock(LoginSettingsService.class);
        var captchaService = mock(RegistrationCaptchaService.class);
        var publicSettings = mock(LoginSettingsDTO.class);
        when(loginSettings.publicLoginSettings()).thenReturn(publicSettings);
        assertThat(new LoginSettingsController(loginSettings, captchaService).get())
                .isSameAs(publicSettings);

        var socialLogin = mock(SocialLoginService.class);
        var providers = List.of(mock(SocialProviderDTO.class));
        when(socialLogin.availableProviders()).thenReturn(providers);
        var loginController = new SocialLoginController(socialLogin);
        assertThat(loginController.providers()).isSameAs(providers);

        var links = List.of(mock(SocialLinkDTO.class));
        when(socialLogin.socialLinks("alice")).thenReturn(links);
        var auth = UsernamePasswordAuthenticationToken.authenticated("alice", "ignored", List.of());
        var linkController = new AccountSocialLinkController(socialLogin);
        assertThat(linkController.links(auth)).isSameAs(links);
        assertThat(linkController.unlink(auth, "google").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(socialLogin).unlink("alice", "google");

        var tokenService = mock(SocialTokenService.class);
        var token = mock(SocialProviderTokenDTO.class);
        when(tokenService.read("alice", "google")).thenReturn(token);
        assertThat(new SocialTokenController(tokenService).token("google", auth)).isSameAs(token);

        var repository = mock(ClientRegistrationRepository.class);
        var registration =
                ClientRegistration.withRegistrationId("google")
                        .clientId("client")
                        .authorizationUri("https://example.test/authorize")
                        .tokenUri("https://example.test/token")
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .build();
        when(repository.findByRegistrationId("google")).thenReturn(registration);
        when(socialLogin.isProviderEnabled("google")).thenReturn(true);
        var startController = new SocialAccountLinkController(repository, socialLogin);
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        startController.start("google", auth, request, response);
        HttpSession session = request.getSession(false);
        assertThat(session.getAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET))
                .isEqualTo(java.util.Map.of("username", "alice", "provider", "google"));
        assertThat(response.getRedirectedUrl()).isEqualTo("/oauth2/authorization/google");

        var invalidResponse = new MockHttpServletResponse();
        when(repository.findByRegistrationId("missing")).thenReturn(null);
        startController.start("missing", auth, new MockHttpServletRequest(), invalidResponse);
        assertThat(invalidResponse.getStatus()).isEqualTo(404);
    }
}
