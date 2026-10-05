package io.github.susimsek.kitezh.service.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.AccountStatusException;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.stereotype.Component;

/** Translates Spring Security authentication events into bounded OAuth2 dashboard counters. */
@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationMetricsEvents {

    private final OAuth2ObservabilityMetrics metrics;

    @EventListener
    public void onSuccess(AuthenticationSuccessEvent event) {
        Authentication authentication = event.getAuthentication();
        String provider = provider(authentication);
        String eventName = eventName(authentication);
        String clientId = clientId(authentication);
        metrics.recordAuthentication(eventName, "success", null, clientId, provider);
    }

    @EventListener
    public void onFailure(AbstractAuthenticationFailureEvent event) {
        Authentication authentication = event.getAuthentication();
        String clientId = clientId(authentication);
        metrics.recordAuthentication(
                eventName(authentication),
                "failure",
                error(event),
                clientId,
                provider(authentication));
    }

    private static String eventName(Authentication authentication) {
        if (authentication instanceof OAuth2ClientAuthenticationToken) {
            return "client_login";
        }
        if (authentication instanceof OAuth2AuthenticationToken) {
            return "social_login";
        }
        return "login";
    }

    private static String clientId(Authentication authentication) {
        if (!(authentication instanceof OAuth2ClientAuthenticationToken token)) {
            return null;
        }
        if (token.getRegisteredClient() == null) {
            return null;
        }
        return token.getRegisteredClient().getClientId();
    }

    private static String provider(Authentication authentication) {
        return authentication instanceof OAuth2AuthenticationToken token
                ? token.getAuthorizedClientRegistrationId()
                : null;
    }

    private static String error(AbstractAuthenticationFailureEvent event) {
        if (event.getException() instanceof BadCredentialsException) {
            return "bad_credentials";
        }
        if (event.getException() instanceof AccountStatusException) {
            return "account_status";
        }
        if (event.getException() instanceof AuthenticationServiceException) {
            return "authentication_service";
        }
        return "authentication_failed";
    }
}
