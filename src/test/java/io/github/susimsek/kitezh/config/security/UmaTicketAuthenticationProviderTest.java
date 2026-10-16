package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorizationPermissionEntity;
import io.github.susimsek.kitezh.domain.AuthorizationPermissionTicketEntity;
import io.github.susimsek.kitezh.domain.AuthorizationPolicyEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionRepository;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionTicketRepository;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceRepository;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.service.authz.AuthorizationPolicyEvaluator;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.assertj.core.api.ThrowableAssert;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

@ExtendWith(MockitoExtension.class)
class UmaTicketAuthenticationProviderTest {

    private static final String CLIENT_ID = "orders-api";
    private static final String RAW_TICKET = "opaque-ticket";

    @Mock private AuthorizationPermissionTicketRepository ticketRepository;
    @Mock private AuthorizationResourceRepository resourceRepository;
    @Mock private AuthorizationPermissionRepository permissionRepository;
    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private OAuth2AuthorizationService authorizationService;
    @Mock private OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;
    @Mock private UserDetailsService userDetailsService;
    @Mock private JwtDecoder jwtDecoder;
    @Mock private AuthorizationPolicyEvaluator policyEvaluator;

    @AfterEach
    void resetAuthorizationServerContext() {
        AuthorizationServerContextHolder.resetContext();
    }

    @Test
    void exchangesActivePermissionTicketForSignedRptAndConsumesTicket() {
        RegisteredClient client = client(true, true);
        OAuth2ClientAuthenticationToken clientPrincipal = authenticatedClient(client);
        AuthorizationPermissionTicketEntity ticket = ticket();
        AuthorizationResourceEntity resource = resource();
        AuthorizationPermissionEntity permission = permission();
        Jwt rpt = rpt();
        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.of(ticket));
        when(resourceRepository.findById("resource-1")).thenReturn(Optional.of(resource));
        when(permissionRepository.findWithPoliciesByResourceId("resource-1"))
                .thenReturn(List.of(permission));
        when(policyEvaluator.isGranted(any(), any(), any(), any())).thenReturn(true);
        when(tokenGenerator.generate(any())).thenReturn(rpt);
        AuthorizationServerContextHolder.setContext(
                org.mockito.Mockito.mock(AuthorizationServerContext.class));

        Authentication result = provider().authenticate(request(clientPrincipal, true));

        assertThat(result).isInstanceOf(OAuth2AccessTokenAuthenticationToken.class);
        OAuth2AccessTokenAuthenticationToken tokenResult =
                (OAuth2AccessTokenAuthenticationToken) result;
        assertThat(tokenResult.getAccessToken().getTokenValue()).isEqualTo("signed-rpt");
        assertThat(tokenResult.getAccessToken().getScopes()).containsExactly("uma_authorization");
        verify(authorizationService).save(any());
        verify(ticketRepository).delete(ticket);
    }

    @Test
    void rejectsMissingClientGrantOrUmaScope() {
        OAuth2ClientAuthenticationToken grantDisabledClient =
                authenticatedClient(client(false, true));
        assertError(
                "unauthorized_client",
                () -> provider().authenticate(request(grantDisabledClient, false)));

        OAuth2ClientAuthenticationToken withoutScope = authenticatedClient(client(true, false));
        assertError("invalid_scope", () -> provider().authenticate(request(withoutScope, false)));

        TestingAuthenticationToken unauthenticated = new TestingAuthenticationToken("client", null);
        assertError(
                "invalid_client", () -> provider().authenticate(request(unauthenticated, false)));
    }

    @Test
    void rejectsInvalidExpiredOrOrphanedPermissionTickets() {
        OAuth2ClientAuthenticationToken clientPrincipal = authenticatedClient(client(true, true));
        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.empty());
        assertError(
                "invalid_grant", () -> provider().authenticate(request(clientPrincipal, false)));

        AuthorizationPermissionTicketEntity expired = ticket();
        expired.setExpiresAt(Instant.now().minusSeconds(1));
        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.of(expired));
        assertError(
                "invalid_grant", () -> provider().authenticate(request(clientPrincipal, false)));

        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.of(ticket()));
        when(resourceRepository.findById("resource-1")).thenReturn(Optional.empty());
        assertError(
                "invalid_grant", () -> provider().authenticate(request(clientPrincipal, false)));
        verify(authorizationService, never()).save(any());
    }

    @Test
    void rejectsWhenNoPermissionIsGrantedOrTokenGeneratorReturnsNonJwt() {
        OAuth2ClientAuthenticationToken clientPrincipal = authenticatedClient(client(true, true));
        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.of(ticket()));
        when(resourceRepository.findById("resource-1")).thenReturn(Optional.of(resource()));
        when(permissionRepository.findWithPoliciesByResourceId("resource-1"))
                .thenReturn(List.of(permission()));
        when(policyEvaluator.isGranted(any(), any(), any(), any())).thenReturn(false);
        assertError(
                "access_denied", () -> provider().authenticate(request(clientPrincipal, false)));

        AuthorizationServerContextHolder.setContext(
                org.mockito.Mockito.mock(AuthorizationServerContext.class));
        when(policyEvaluator.isGranted(any(), any(), any(), any())).thenReturn(true);
        when(tokenGenerator.generate(any())).thenReturn(null);
        assertError("server_error", () -> provider().authenticate(request(clientPrincipal, false)));
        verify(ticketRepository, never()).delete(any());
    }

    @Test
    void recognizesOnlyUmaTicketGrantRequests() {
        assertThat(provider().supports(UmaTicketAuthenticationToken.class)).isTrue();
        assertThat(provider().supports(TestingAuthenticationToken.class)).isFalse();
    }

    private UmaTicketAuthenticationProvider provider() {
        return new UmaTicketAuthenticationProvider(
                ticketRepository,
                resourceRepository,
                permissionRepository,
                authorizationRepository,
                authorizationService,
                tokenGenerator,
                userDetailsService,
                jwtDecoder,
                policyEvaluator);
    }

    private static UmaTicketAuthenticationToken request(
            Authentication principal, boolean includeResourceName) {
        return new UmaTicketAuthenticationToken(
                principal,
                Map.of(
                        "ticket",
                        RAW_TICKET,
                        "response_include_resource_name",
                        includeResourceName));
    }

    private static RegisteredClient client(boolean grantEnabled, boolean scopeEnabled) {
        RegisteredClient.Builder builder =
                RegisteredClient.withId("client-id")
                        .clientId(CLIENT_ID)
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(
                                org.springframework.security.oauth2.core.AuthorizationGrantType
                                        .CLIENT_CREDENTIALS);
        if (grantEnabled) {
            builder.authorizationGrantType(
                    new org.springframework.security.oauth2.core.AuthorizationGrantType(
                            AuthorizationGrantTypes.UMA_TICKET));
        }
        if (scopeEnabled) {
            builder.scope("uma_authorization");
        }
        return builder.build();
    }

    private static OAuth2ClientAuthenticationToken authenticatedClient(RegisteredClient client) {
        return new OAuth2ClientAuthenticationToken(
                client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "not-a-real-secret");
    }

    private static AuthorizationPermissionTicketEntity ticket() {
        AuthorizationPermissionTicketEntity ticket = new AuthorizationPermissionTicketEntity();
        ticket.setId(UmaTicketTokens.digest(RAW_TICKET));
        ticket.setResourceId("resource-1");
        ticket.setResourceServerClientId(CLIENT_ID);
        ticket.setRequestedScopes("read");
        ticket.setExpiresAt(Instant.now().plusSeconds(60));
        return ticket;
    }

    private static AuthorizationResourceEntity resource() {
        AuthorizationResourceEntity resource = new AuthorizationResourceEntity();
        resource.setId("resource-1");
        resource.setResourceServerClientId(CLIENT_ID);
        resource.setName("Orders");
        return resource;
    }

    private static AuthorizationPermissionEntity permission() {
        AuthorizationPermissionEntity permission = new AuthorizationPermissionEntity();
        permission.setScopeName("read");
        permission.setDecisionStrategy("AFFIRMATIVE");
        AuthorizationPolicyEntity policy = new AuthorizationPolicyEntity();
        policy.setType("PUBLIC");
        policy.setEffect("ALLOW");
        permission.setPolicies(new LinkedHashSet<>(List.of(policy)));
        return permission;
    }

    private static Jwt rpt() {
        Instant now = Instant.now();
        return Jwt.withTokenValue("signed-rpt")
                .header("alg", "RS256")
                .subject(CLIENT_ID)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build();
    }

    private static void assertError(String expectedCode, ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action)
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo(expectedCode));
    }
}
