package io.github.susimsek.kitezh.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.SessionInvalidationService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.ImpersonationService;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.FactorGrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.switchuser.SwitchUserGrantedAuthority;
import org.springframework.security.web.context.SecurityContextRepository;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class ImpersonationControllerTest {

    @Mock private ImpersonationService impersonationService;
    @Mock private UserDetailsService userDetailsService;
    @Mock private SessionInvalidationService sessionInvalidationService;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private SecurityContextRepository securityContextRepository;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void preservesAuthenticationFactorForOidcTokenGeneration() throws Exception {
        UserEntity target = new UserEntity();
        target.setId(2L);
        target.setUsername("user");
        when(impersonationService.consume(anyString(), any(Authentication.class)))
                .thenReturn(target);
        when(userDetailsService.loadUserByUsername("user"))
                .thenReturn(User.withUsername("user").password("password").roles("USER").build());

        FactorGrantedAuthority factor =
                FactorGrantedAuthority.withAuthority(FactorGrantedAuthority.PASSWORD_AUTHORITY)
                        .build();
        Authentication actor =
                UsernamePasswordAuthenticationToken.authenticated(
                        User.withUsername("admin").password("password").roles("ADMIN").build(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), factor));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession();
        request.setCookies(new Cookie("IMPERSONATION_TICKET", "ticket"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        controller().accept(actor, request, response);

        ArgumentCaptor<SecurityContext> context = ArgumentCaptor.forClass(SecurityContext.class);
        verify(securityContextRepository).saveContext(context.capture(), any(), any());
        assertThat(context.getValue().getAuthentication().getAuthorities())
                .anyMatch(factor::equals);
        assertThat(response.getRedirectedUrl()).isEqualTo("/account/?impersonated=1");
        assertThat(response.getCookies())
                .anyMatch(
                        cookie ->
                                "IMPERSONATION_TICKET".equals(cookie.getName())
                                        && cookie.getMaxAge() == 0
                                        && "/impersonation".equals(cookie.getPath()));
        verify(auditEventService)
                .record(
                        "user.impersonation.accepted",
                        "user",
                        "2",
                        "actor=admin;targetUsername=user;result=success");
    }

    @Test
    void rejectsAcceptWithoutTicketCookie() {
        Authentication actor = authentication("admin", "ROLE_ADMIN");

        assertThatThrownBy(
                        () ->
                                controller()
                                        .accept(
                                                actor,
                                                new MockHttpServletRequest(),
                                                new MockHttpServletResponse()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ticket is required");
    }

    @Test
    void restoresPreviousAuthenticationAndInvalidatesSessionOnExit() throws Exception {
        Authentication original = authentication("admin", "ROLE_ADMIN");
        Authentication impersonated = authentication("user", "ROLE_USER");
        Authentication current =
                UsernamePasswordAuthenticationToken.authenticated(
                        impersonated.getPrincipal(),
                        null,
                        List.of(
                                new SimpleGrantedAuthority("ROLE_USER"),
                                new SwitchUserGrantedAuthority(
                                        AuthoritiesConstants.PREVIOUS_ADMINISTRATOR, original)));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession();
        String sessionId = request.getSession(false).getId();
        MockHttpServletResponse response = new MockHttpServletResponse();

        controller().exit(current, request, response);

        verify(sessionInvalidationService).invalidateAuthorizations(sessionId);
        verify(auditEventService)
                .recordAs(
                        "admin",
                        "user.impersonation.ended",
                        "user",
                        "user",
                        "actor=admin;targetUsername=user;result=success");
        ArgumentCaptor<SecurityContext> context = ArgumentCaptor.forClass(SecurityContext.class);
        verify(securityContextRepository).saveContext(context.capture(), any(), any());
        assertThat(context.getValue().getAuthentication()).isSameAs(original);
        assertThat(response.getRedirectedUrl()).isEqualTo("/admin/?impersonation_ended=1");
    }

    @Test
    void exitsWithoutSessionWhenNoSessionWasCreated() throws Exception {
        Authentication original = authentication("admin", "ROLE_ADMIN");
        Authentication current =
                UsernamePasswordAuthenticationToken.authenticated(
                        "user",
                        null,
                        List.of(
                                new SimpleGrantedAuthority("ROLE_USER"),
                                new SwitchUserGrantedAuthority(
                                        AuthoritiesConstants.PREVIOUS_ADMINISTRATOR, original)));

        controller().exit(current, new MockHttpServletRequest(), new MockHttpServletResponse());

        org.mockito.Mockito.verifyNoInteractions(sessionInvalidationService);
    }

    @Test
    void rejectsExitWhenSessionIsNotImpersonated() {
        Authentication actor = authentication("admin", "ROLE_ADMIN");

        assertThatThrownBy(
                        () ->
                                controller()
                                        .exit(
                                                actor,
                                                new MockHttpServletRequest(),
                                                new MockHttpServletResponse()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Not impersonating a user");
    }

    private ImpersonationController controller() {
        return new ImpersonationController(
                impersonationService,
                userDetailsService,
                sessionInvalidationService,
                auditEventService,
                securityContextRepository);
    }

    private static Authentication authentication(String username, String authority) {
        return UsernamePasswordAuthenticationToken.authenticated(
                username, "ignored", List.of(new SimpleGrantedAuthority(authority)));
    }
}
