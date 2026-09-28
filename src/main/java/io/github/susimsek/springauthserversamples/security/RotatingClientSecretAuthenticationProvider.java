package io.github.susimsek.springauthserversamples.security;

import java.time.Instant;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

/** Accepts a rotated client secret only while its configured grace period is active. */
public final class RotatingClientSecretAuthenticationProvider implements AuthenticationProvider {

    private final RegisteredClientRepository registeredClientRepository;
    private final PasswordEncoder passwordEncoder;

    public RotatingClientSecretAuthenticationProvider(
            RegisteredClientRepository registeredClientRepository,
            PasswordEncoder passwordEncoder) {
        this.registeredClientRepository = registeredClientRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public Authentication authenticate(Authentication authentication)
            throws AuthenticationException {
        OAuth2ClientAuthenticationToken clientAuthentication =
                (OAuth2ClientAuthenticationToken) authentication;
        if (!ClientAuthenticationMethod.CLIENT_SECRET_BASIC.equals(
                        clientAuthentication.getClientAuthenticationMethod())
                && !ClientAuthenticationMethod.CLIENT_SECRET_POST.equals(
                        clientAuthentication.getClientAuthenticationMethod())) {
            return null;
        }
        RegisteredClient client =
                registeredClientRepository.findByClientId(
                        clientAuthentication.getPrincipal().toString());
        if (client == null
                || client.getClientSecret() == null
                || clientAuthentication.getCredentials() == null) {
            return null;
        }
        String previousSecret =
                ClientSecuritySettings.stringSetting(
                        client, ClientSecuritySettings.PREVIOUS_SECRET);
        if (previousSecret == null
                || !passwordEncoder.matches(
                        clientAuthentication.getCredentials().toString(), previousSecret)) {
            return null;
        }
        Object expiresAt =
                client.getClientSettings()
                        .getSetting(ClientSecuritySettings.PREVIOUS_SECRET_EXPIRES_AT);
        if (!(expiresAt instanceof String value) || expired(value)) {
            return null;
        }
        if (!client.getClientAuthenticationMethods()
                .contains(clientAuthentication.getClientAuthenticationMethod())) {
            return null;
        }
        return new OAuth2ClientAuthenticationToken(
                client,
                clientAuthentication.getClientAuthenticationMethod(),
                clientAuthentication.getCredentials());
    }

    private static boolean expired(String value) {
        try {
            return Instant.now().isAfter(Instant.parse(value));
        } catch (RuntimeException _) {
            return true;
        }
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return OAuth2ClientAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
