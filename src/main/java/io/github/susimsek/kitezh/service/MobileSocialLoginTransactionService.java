package io.github.susimsek.kitezh.service;

import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

/** Binds a selected, server-configured identity provider to a validated mobile PKCE request. */
@Service
@RequiredArgsConstructor
public class MobileSocialLoginTransactionService {

    public static final String SESSION_ATTRIBUTE =
            MobileSocialLoginTransactionService.class.getName() + ".PENDING";
    private static final Duration TRANSACTION_TTL = Duration.ofMinutes(10);
    private static final Set<String> MOBILE_CLIENTS =
            Set.of("mobile-account-console", "mobile-admin-console");
    private static final Pattern STATE_PATTERN = Pattern.compile("[A-Za-z0-9._~-]{32,256}");
    private static final Pattern CHALLENGE_PATTERN = Pattern.compile("[A-Za-z0-9_-]{43,128}");
    private static final Set<String> LOCALES = Set.of("en", "tr");

    private final RegisteredClientRepository clients;
    private final SocialLoginService socialLoginService;

    public String begin(String providerAlias, Map<String, String> parameters, HttpSession session) {
        String registrationId = socialLoginService.mobileLoginRegistrationId(providerAlias);
        if (!StringUtils.hasText(registrationId)) {
            throw new IllegalArgumentException("provider_unavailable");
        }
        String clientId = required(parameters, "client_id");
        RegisteredClient client = clients.findByClientId(clientId);
        if (client == null
                || !MOBILE_CLIENTS.contains(clientId)
                || !client.getClientAuthenticationMethods()
                        .contains(
                                org.springframework.security.oauth2.core.ClientAuthenticationMethod
                                        .NONE)
                || !client.getAuthorizationGrantTypes()
                        .contains(AuthorizationGrantType.AUTHORIZATION_CODE)
                || !client.getClientSettings().isRequireProofKey()) {
            throw new IllegalArgumentException("mobile_client_unavailable");
        }
        String redirectUri = required(parameters, "redirect_uri");
        if (!client.getRedirectUris().contains(redirectUri)) {
            throw new IllegalArgumentException("redirect_uri_invalid");
        }
        String state = required(parameters, "state");
        String challenge = required(parameters, "code_challenge");
        if (!STATE_PATTERN.matcher(state).matches()
                || !CHALLENGE_PATTERN.matcher(challenge).matches()
                || !"S256".equals(parameters.get("code_challenge_method"))) {
            throw new IllegalArgumentException("pkce_request_invalid");
        }
        if (!"code".equals(parameters.get("response_type"))) {
            throw new IllegalArgumentException("response_type_invalid");
        }
        String scope = required(parameters, "scope");
        Set<String> scopes = new LinkedHashSet<>(Arrays.asList(scope.trim().split("\\s+")));
        if (!scopes.contains("openid") || !client.getScopes().containsAll(scopes)) {
            throw new IllegalArgumentException("scope_invalid");
        }
        String locale = parameters.get("ui_locales");
        if (StringUtils.hasText(locale) && !LOCALES.contains(locale)) {
            throw new IllegalArgumentException("locale_invalid");
        }

        Map<String, String> authorizationParameters = new LinkedHashMap<>();
        authorizationParameters.put("response_type", "code");
        authorizationParameters.put("client_id", clientId);
        authorizationParameters.put("redirect_uri", redirectUri);
        authorizationParameters.put("scope", String.join(" ", scopes));
        authorizationParameters.put("state", state);
        authorizationParameters.put("code_challenge", challenge);
        authorizationParameters.put("code_challenge_method", "S256");
        if (StringUtils.hasText(locale)) {
            authorizationParameters.put("ui_locales", locale);
        }
        UriComponentsBuilder authorizationUri = UriComponentsBuilder.fromPath("/oauth2/authorize");
        authorizationParameters.forEach(authorizationUri::queryParam);
        String authorizationUrl = authorizationUri.build().encode().toUriString();
        session.setAttribute(
                SESSION_ATTRIBUTE,
                new PendingTransaction(authorizationUrl, Instant.now().plus(TRANSACTION_TTL)));
        return "/oauth2/authorization/" + registrationId;
    }

    public String consume(HttpSession session) {
        if (session == null) {
            return null;
        }
        Object value = session.getAttribute(SESSION_ATTRIBUTE);
        session.removeAttribute(SESSION_ATTRIBUTE);
        if (!(value instanceof PendingTransaction transaction)
                || transaction.expiresAt().isBefore(Instant.now())) {
            return null;
        }
        return transaction.authorizationUrl();
    }

    public String peek(HttpSession session) {
        if (session == null) {
            return null;
        }
        Object value = session.getAttribute(SESSION_ATTRIBUTE);
        if (!(value instanceof PendingTransaction transaction)
                || transaction.expiresAt().isBefore(Instant.now())) {
            return null;
        }
        return transaction.authorizationUrl();
    }

    public String failureRedirect(HttpSession session) {
        if (session == null) {
            return null;
        }
        Object value = session.getAttribute(SESSION_ATTRIBUTE);
        session.removeAttribute(SESSION_ATTRIBUTE);
        if (!(value instanceof PendingTransaction transaction)
                || transaction.expiresAt().isBefore(Instant.now())) {
            return null;
        }
        var authorizationParameters =
                UriComponentsBuilder.fromUriString(transaction.authorizationUrl())
                        .build(true)
                        .getQueryParams();
        String redirectUri = authorizationParameters.getFirst("redirect_uri");
        String state = authorizationParameters.getFirst("state");
        if (!StringUtils.hasText(redirectUri) || !StringUtils.hasText(state)) {
            return null;
        }
        return UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("error", "access_denied")
                .queryParam("state", state)
                .build()
                .encode()
                .toUriString();
    }

    private static String required(Map<String, String> values, String key) {
        String value = values.get(key);
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("authorization_request_invalid");
        }
        return value;
    }

    private record PendingTransaction(String authorizationUrl, Instant expiresAt) {}
}
