package io.github.susimsek.springauthserversamples.service.ciba;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** Authenticates confidential clients calling the CIBA backchannel endpoint. */
@Service
@RequiredArgsConstructor
public class CibaClientAuthenticationService {

    private final RegisteredClientRepository registeredClientRepository;
    private final PasswordEncoder passwordEncoder;

    public OAuth2ClientAuthenticationToken authenticate(HttpServletRequest request) {
        Credentials credentials = credentials(request);
        RegisteredClient client = registeredClientRepository.findByClientId(credentials.clientId());
        if (client == null
                || !client.getClientAuthenticationMethods().contains(credentials.method())
                || !StringUtils.hasText(client.getClientSecret())
                || !passwordEncoder.matches(credentials.clientSecret(), client.getClientSecret())) {
            throw new CibaProtocolException(
                    "invalid_client", "Client authentication failed", HttpStatus.UNAUTHORIZED);
        }
        return new OAuth2ClientAuthenticationToken(
                client, credentials.method(), credentials.clientSecret());
    }

    private static Credentials credentials(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        String clientId = request.getParameter("client_id");
        String clientSecret = request.getParameter("client_secret");
        ClientAuthenticationMethod method = ClientAuthenticationMethod.CLIENT_SECRET_POST;

        if (StringUtils.hasText(authorization)) {
            if (!authorization.regionMatches(true, 0, "Basic ", 0, 6)) {
                throw invalidRequest("Unsupported client authentication method");
            }
            if (StringUtils.hasText(clientId) || StringUtils.hasText(clientSecret)) {
                throw invalidRequest("Multiple client credentials were provided");
            }
            String encoded = authorization.substring(6).trim();
            try {
                String decoded =
                        new String(Base64.getDecoder().decode(encoded), StandardCharsets.UTF_8);
                int separator = decoded.indexOf(':');
                if (separator <= 0) {
                    throw invalidRequest("Invalid client authentication");
                }
                clientId = decoded.substring(0, separator);
                clientSecret = decoded.substring(separator + 1);
                method = ClientAuthenticationMethod.CLIENT_SECRET_BASIC;
            } catch (IllegalArgumentException _) {
                throw invalidRequest("Invalid client authentication");
            }
        }

        if (!StringUtils.hasText(clientId) || !StringUtils.hasText(clientSecret)) {
            throw new CibaProtocolException(
                    "invalid_client", "Client authentication is required", HttpStatus.UNAUTHORIZED);
        }
        return new Credentials(clientId, clientSecret, method);
    }

    private static CibaProtocolException invalidRequest(String message) {
        return new CibaProtocolException("invalid_request", message, HttpStatus.BAD_REQUEST);
    }

    private record Credentials(
            String clientId, String clientSecret, ClientAuthenticationMethod method) {}
}
