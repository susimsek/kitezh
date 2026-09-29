package io.github.susimsek.springauthserversamples.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationFailureDisabledEvent;
import org.springframework.security.authentication.event.AuthenticationFailureLockedEvent;
import org.springframework.security.authentication.event.AuthenticationFailureServiceExceptionEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

class OAuth2AuthenticationMetricsEventsTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final OAuth2AuthenticationMetricsEvents events =
            new OAuth2AuthenticationMetricsEvents(new OAuth2ObservabilityMetrics(registry));

    @Test
    void recordsLocalSocialAndClientLogins() {
        Authentication local =
                UsernamePasswordAuthenticationToken.authenticated("alice", "", List.of());
        events.onSuccess(new AuthenticationSuccessEvent(local));

        OAuth2User socialUser = mock(OAuth2User.class);
        OAuth2AuthenticationToken social =
                new OAuth2AuthenticationToken(socialUser, List.of(), "github");
        events.onSuccess(new AuthenticationSuccessEvent(social));

        OAuth2ClientAuthenticationToken client = mock(OAuth2ClientAuthenticationToken.class);
        RegisteredClient registeredClient = mock(RegisteredClient.class);
        when(client.getRegisteredClient()).thenReturn(registeredClient);
        when(registeredClient.getClientId()).thenReturn("demo-client");
        events.onSuccess(new AuthenticationSuccessEvent(client));

        assertThat(count("login", "success")).isEqualTo(1);
        assertThat(count("social_login", "success")).isEqualTo(1);
        assertThat(count("client_login", "success")).isEqualTo(1);
    }

    @Test
    void mapsAuthenticationFailureCategories() {
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated("alice", "", List.of());
        events.onFailure(
                new AuthenticationFailureBadCredentialsEvent(
                        authentication, new BadCredentialsException("bad")));
        events.onFailure(
                new AuthenticationFailureDisabledEvent(
                        authentication, new DisabledException("disabled")));
        events.onFailure(
                new AuthenticationFailureLockedEvent(
                        authentication, new LockedException("locked")));
        events.onFailure(
                new AuthenticationFailureServiceExceptionEvent(
                        authentication, new AuthenticationServiceException("service")));

        assertThat(countWithError("bad_credentials")).isEqualTo(1);
        assertThat(countWithError("account_status")).isEqualTo(2);
        assertThat(countWithError("authentication_service")).isEqualTo(1);
    }

    @Test
    void recordsClientFailureWithRegisteredClient() {
        OAuth2ClientAuthenticationToken client = mock(OAuth2ClientAuthenticationToken.class);
        RegisteredClient registeredClient = mock(RegisteredClient.class);
        when(client.getRegisteredClient()).thenReturn(registeredClient);
        when(registeredClient.getClientId()).thenReturn("demo-client");

        events.onFailure(
                new AbstractAuthenticationFailureEvent(
                        client,
                        new org.springframework.security.core.AuthenticationException(
                                "failed") {}) {});

        assertThat(
                        registry.get("spring.authorization.server.events")
                                .tag("event", "client_login")
                                .tag("client_id", "demo-client")
                                .tag("outcome", "failure")
                                .counter()
                                .count())
                .isEqualTo(1);
    }

    private double count(String event, String outcome) {
        return registry.get("spring.authorization.server.events")
                .tag("event", event)
                .tag("outcome", outcome)
                .counter()
                .count();
    }

    private double countWithError(String error) {
        return registry.get("spring.authorization.server.events")
                .tag("error", error)
                .counter()
                .count();
    }
}
