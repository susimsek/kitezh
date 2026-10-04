package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.service.LoginSettingsService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;

class DynamicRememberMeServicesTest {

    private final LoginSettingsService settings = mock(LoginSettingsService.class);
    private final UserDetailsService users = mock(UserDetailsService.class);
    private final DynamicRememberMeServices rememberMe =
            new DynamicRememberMeServices(settings, users);
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    @Test
    void doesNothingWhenRememberMeIsDisabled() {
        when(settings.isRememberMeEnabled()).thenReturn(false);

        assertThat(rememberMe.autoLogin(request, response)).isNull();
        rememberMe.loginFail(request, response);
        rememberMe.loginSuccess(request, response, mock(Authentication.class));

        verify(settings, times(3)).isRememberMeEnabled();
    }

    @Test
    void delegatesEnabledAutoLoginAndInitializesDelegateLazily() {
        when(settings.isRememberMeEnabled()).thenReturn(true);

        assertThat(rememberMe.autoLogin(request, response)).isNull();
        rememberMe.loginFail(request, response);
        rememberMe.loginSuccess(request, response, mock(Authentication.class));

        verify(settings, times(3)).isRememberMeEnabled();
    }
}
