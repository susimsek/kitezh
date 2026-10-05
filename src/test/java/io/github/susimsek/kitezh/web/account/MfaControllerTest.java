package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.MfaAuthorizationFilter;
import io.github.susimsek.kitezh.dto.account.MfaCodeRequestDTO;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;

class MfaControllerTest {

    @Test
    void validCodeMarksCurrentSessionVerified() {
        MfaService mfaService = mock(MfaService.class);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("alice");
        when(mfaService.valid("alice", "123456")).thenReturn(true);
        MockHttpServletRequest request = new MockHttpServletRequest();

        var response =
                new MfaController(mfaService)
                        .verify(authentication, new MfaCodeRequestDTO("123456"), request);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(request.getSession(false).getAttribute(MfaAuthorizationFilter.MFA_VERIFIED))
                .isEqualTo(true);
    }

    @Test
    void invalidCodeDoesNotCreateVerifiedSession() {
        MfaService mfaService = mock(MfaService.class);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("alice");
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertThatThrownBy(
                        () ->
                                new MfaController(mfaService)
                                        .verify(
                                                authentication,
                                                new MfaCodeRequestDTO("000000"),
                                                request))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        error ->
                                assertThat(error.getErrorCode())
                                        .isEqualTo(ApiErrorCode.INVALID_TOTP_CODE));
        assertThat(request.getSession(false)).isNull();
    }
}
