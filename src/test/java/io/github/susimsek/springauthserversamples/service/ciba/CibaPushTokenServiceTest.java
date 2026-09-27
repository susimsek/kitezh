package io.github.susimsek.springauthserversamples.service.ciba;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus;
import io.github.susimsek.springauthserversamples.repository.CibaAuthenticationRequestRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

class CibaPushTokenServiceTest {

    private final CibaAuthenticationRequestRepository requests =
            mock(CibaAuthenticationRequestRepository.class);
    private final RegisteredClientRepository clients = mock(RegisteredClientRepository.class);
    private final UserDetailsService users = mock(UserDetailsService.class);
    private final OAuth2AuthorizationService authorizations =
            mock(OAuth2AuthorizationService.class);

    @SuppressWarnings("unchecked")
    private final OAuth2TokenGenerator<OAuth2Token> tokens = mock(OAuth2TokenGenerator.class);

    private final CibaNotificationService notifications = mock(CibaNotificationService.class);
    private final AuthorizationServerSettings serverSettings =
            AuthorizationServerSettings.builder().issuer("https://issuer.example").build();
    private final CibaPushTokenService service =
            new CibaPushTokenService(
                    requests,
                    clients,
                    users,
                    authorizations,
                    tokens,
                    notifications,
                    serverSettings);
    private final RegisteredClient client = client();

    @BeforeEach
    void setUp() {
        when(requests.save(any(CibaAuthenticationRequestEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(clients.findById(client.getId())).thenReturn(client);
        when(users.loadUserByUsername("admin"))
                .thenReturn(User.withUsername("admin").password("ignored").roles("USER").build());
        when(notifications.deliverPush(any(), any())).thenReturn(true);
        when(tokens.generate(any(OAuth2TokenContext.class)))
                .thenAnswer(
                        invocation -> {
                            OAuth2TokenContext context = invocation.getArgument(0);
                            Instant issuedAt = Instant.now();
                            return switch (context.getTokenType().getValue()) {
                                case "access_token" ->
                                        new OAuth2AccessToken(
                                                OAuth2AccessToken.TokenType.BEARER,
                                                "access-token",
                                                issuedAt,
                                                issuedAt.plusSeconds(300),
                                                context.getAuthorizedScopes());
                                case "id_token" ->
                                        Jwt.withTokenValue("id-token")
                                                .header("alg", "RS256")
                                                .claim("sub", "admin")
                                                .issuedAt(issuedAt)
                                                .expiresAt(issuedAt.plusSeconds(300))
                                                .build();
                                case "refresh_token" ->
                                        new OAuth2RefreshToken("refresh-token", issuedAt);
                                default -> null;
                            };
                        });
    }

    @Test
    void deliversTokensAndConsumesApprovedRequest() {
        CibaAuthenticationRequestEntity request = request(CibaAuthenticationRequestStatus.APPROVED);

        service.issue(request);

        assertThat(request.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.CONSUMED);
        assertThat(request.getConsumedAt()).isNotNull();
        ArgumentCaptor<Map<String, Object>> response = ArgumentCaptor.forClass(Map.class);
        verify(notifications).deliverPush(eq(request), response.capture());
        assertThat(response.getValue())
                .containsKeys("access_token", "id_token", "refresh_token", "expires_in")
                .containsEntry("scope", "openid offline_access");
        verify(authorizations).save(any());
    }

    @Test
    void ignoresNonApprovedRequestsAndRejectsMissingClients() {
        CibaAuthenticationRequestEntity pending = request(CibaAuthenticationRequestStatus.PENDING);
        service.issue(pending);
        assertThat(pending.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.PENDING);

        when(clients.findById(client.getId())).thenReturn(null);
        CibaAuthenticationRequestEntity approved =
                request(CibaAuthenticationRequestStatus.APPROVED);
        assertThatThrownBy(() -> service.issue(approved))
                .isInstanceOf(CibaProtocolException.class)
                .hasMessageContaining("registered CIBA client");
    }

    @Test
    void keepsApprovedRequestWhenDeliveryFails() {
        when(notifications.deliverPush(any(), any())).thenReturn(false);

        CibaAuthenticationRequestEntity request = request(CibaAuthenticationRequestStatus.APPROVED);
        assertThatThrownBy(() -> service.issue(request))
                .isInstanceOf(CibaProtocolException.class)
                .hasMessageContaining("push notification failed");
        assertThat(request.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.APPROVED);
    }

    @Test
    void rejectsMissingAccessToken() {
        when(tokens.generate(any())).thenReturn(null);

        CibaAuthenticationRequestEntity request = request(CibaAuthenticationRequestStatus.APPROVED);
        assertThatThrownBy(() -> service.issue(request))
                .isInstanceOf(CibaProtocolException.class)
                .hasMessageContaining("access token");
    }

    @Test
    void rejectsInvalidIdAndRefreshTokens() {
        Mockito.reset(tokens);
        when(tokens.generate(any()))
                .thenAnswer(
                        invocation -> {
                            OAuth2TokenContext context = invocation.getArgument(0);
                            Instant issuedAt = Instant.now();
                            return switch (context.getTokenType().getValue()) {
                                case "access_token" ->
                                        new OAuth2AccessToken(
                                                OAuth2AccessToken.TokenType.BEARER,
                                                "access-token",
                                                issuedAt,
                                                issuedAt.plusSeconds(300));
                                default ->
                                        new OAuth2AccessToken(
                                                OAuth2AccessToken.TokenType.BEARER,
                                                "unexpected",
                                                issuedAt,
                                                issuedAt.plusSeconds(300));
                            };
                        });

        CibaAuthenticationRequestEntity invalidIdTokenRequest =
                request(CibaAuthenticationRequestStatus.APPROVED);
        assertThatThrownBy(() -> service.issue(invalidIdTokenRequest))
                .isInstanceOf(CibaProtocolException.class)
                .hasMessageContaining("refresh token");

        Mockito.reset(tokens);
        when(tokens.generate(any()))
                .thenAnswer(
                        invocation -> {
                            OAuth2TokenContext context = invocation.getArgument(0);
                            Instant issuedAt = Instant.now();
                            return switch (context.getTokenType().getValue()) {
                                case "access_token" ->
                                        new OAuth2AccessToken(
                                                OAuth2AccessToken.TokenType.BEARER,
                                                "access-token",
                                                issuedAt,
                                                issuedAt.plusSeconds(300));
                                case "id_token" ->
                                        new OAuth2AccessToken(
                                                OAuth2AccessToken.TokenType.BEARER,
                                                "unexpected-id",
                                                issuedAt,
                                                issuedAt.plusSeconds(300));
                                case "refresh_token" ->
                                        new OAuth2RefreshToken(
                                                "refresh-token",
                                                issuedAt,
                                                issuedAt.plusSeconds(600));
                                default ->
                                        new OAuth2AccessToken(
                                                OAuth2AccessToken.TokenType.BEARER,
                                                "unexpected",
                                                issuedAt,
                                                issuedAt.plusSeconds(300));
                            };
                        });

        CibaAuthenticationRequestEntity invalidRefreshTokenRequest =
                request(CibaAuthenticationRequestStatus.APPROVED);
        assertThatThrownBy(() -> service.issue(invalidRefreshTokenRequest))
                .isInstanceOf(CibaProtocolException.class)
                .hasMessageContaining("ID token");
    }

    private CibaAuthenticationRequestEntity request(CibaAuthenticationRequestStatus status) {
        CibaAuthenticationRequestEntity request =
                new CibaAuthenticationRequestEntity(
                        "auth-req-id",
                        client.getId(),
                        "admin",
                        "openid offline_access",
                        null,
                        ClientSecuritySettings.CIBA_PUSH,
                        "https://client.example/ciba/notify",
                        "notification-token",
                        Instant.now(),
                        Instant.now().plusSeconds(300),
                        5);
        request.setStatus(status);
        return request;
    }

    private static RegisteredClient client() {
        return RegisteredClient.withId("client-id")
                .clientId("demo")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .scope("openid")
                .scope("offline_access")
                .build();
    }
}
