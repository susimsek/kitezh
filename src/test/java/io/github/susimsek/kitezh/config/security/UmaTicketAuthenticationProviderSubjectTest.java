package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

@ExtendWith(MockitoExtension.class)
class UmaTicketAuthenticationProviderSubjectTest {

    private static final String CLIENT_ID = "orders-api";
    private static final String RAW_TICKET = "opaque-ticket";
    private static final String SUBJECT_TOKEN = "subject-token";

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
    void evaluatesAndIssuesRptForActiveSubjectTokenIncludingGroupAuthorities() {
        AuthorizationPermissionTicketEntity ticket = ticket();
        AuthorizationResourceEntity resource = resource();
        AuthorizationPermissionEntity permission = permission("read");
        Jwt subjectJwt = jwt(SUBJECT_TOKEN, "alice").claim("groups", List.of("operators")).build();
        Jwt rpt = jwt("signed-rpt", "alice").build();
        AuthorizationEntity authorization = authorization();
        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.of(ticket));
        when(resourceRepository.findById("resource-1")).thenReturn(Optional.of(resource));
        when(permissionRepository.findWithPoliciesByResourceId("resource-1"))
                .thenReturn(List.of(permission));
        when(policyEvaluator.isGranted(any(), any(), any(), any())).thenReturn(true);
        when(jwtDecoder.decode(SUBJECT_TOKEN)).thenReturn(subjectJwt);
        when(authorizationRepository.findByAccessTokenValue(SUBJECT_TOKEN))
                .thenReturn(Optional.of(authorization));
        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(
                        User.withUsername("alice")
                                .password("unused")
                                .authorities(new SimpleGrantedAuthority("ROLE_USER"))
                                .build());
        when(tokenGenerator.generate(any())).thenReturn(rpt);
        AuthorizationServerContextHolder.setContext(
                org.mockito.Mockito.mock(AuthorizationServerContext.class));

        Authentication result =
                provider()
                        .authenticate(
                                request(
                                        authenticatedClient(),
                                        Map.of(
                                                "ticket", RAW_TICKET,
                                                "subject_token", SUBJECT_TOKEN,
                                                "response_include_resource_name", true)));

        assertThat(result.getName()).isEqualTo(CLIENT_ID);
        ArgumentCaptor<OAuth2TokenContext> tokenContextCaptor =
                ArgumentCaptor.forClass(OAuth2TokenContext.class);
        verify(tokenGenerator).generate(tokenContextCaptor.capture());
        Authentication evaluatedSubject = tokenContextCaptor.getValue().getPrincipal();
        assertThat(evaluatedSubject.getName()).isEqualTo("alice");
        assertThat(evaluatedSubject.getAuthorities())
                .extracting("authority")
                .contains("ROLE_USER", "GROUP_operators");
        UmaTicketAuthenticationToken grant =
                (UmaTicketAuthenticationToken)
                        tokenContextCaptor.getValue().getAuthorizationGrant();
        assertThat(
                        grant.getAdditionalParameters()
                                .get(UmaTicketAuthenticationToken.AUTHORIZATION_PERMISSIONS))
                .isEqualTo(
                        List.of(
                                Map.of(
                                        "resource_set_id",
                                        "resource-1",
                                        "scopes",
                                        List.of("read"),
                                        "resource_set_name",
                                        "Orders")));
        verify(authorizationService).save(any());
        verify(ticketRepository).delete(ticket);
    }

    @Test
    void rejectsSubjectTokenWhenItCannotBeDecoded() {
        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.of(ticket()));
        when(resourceRepository.findById("resource-1")).thenReturn(Optional.of(resource()));
        when(jwtDecoder.decode(SUBJECT_TOKEN)).thenThrow(new IllegalArgumentException("invalid"));

        assertThatThrownBy(
                        () ->
                                provider()
                                        .authenticate(
                                                request(
                                                        authenticatedClient(),
                                                        Map.of(
                                                                "ticket",
                                                                RAW_TICKET,
                                                                "subject_token",
                                                                SUBJECT_TOKEN))))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .extracting(
                        exception ->
                                ((OAuth2AuthenticationException) exception)
                                        .getError()
                                        .getErrorCode())
                .isEqualTo("invalid_grant");
    }

    @Test
    void rejectsSubjectTokenWhoseJwtSubjectDoesNotMatchItsActiveAuthorization() {
        when(ticketRepository.findById(UmaTicketTokens.digest(RAW_TICKET)))
                .thenReturn(Optional.of(ticket()));
        when(resourceRepository.findById("resource-1")).thenReturn(Optional.of(resource()));
        when(jwtDecoder.decode(SUBJECT_TOKEN)).thenReturn(jwt(SUBJECT_TOKEN, "mallory").build());
        when(authorizationRepository.findByAccessTokenValue(SUBJECT_TOKEN))
                .thenReturn(Optional.of(authorization()));

        assertThatThrownBy(
                        () ->
                                provider()
                                        .authenticate(
                                                request(
                                                        authenticatedClient(),
                                                        Map.of(
                                                                "ticket",
                                                                RAW_TICKET,
                                                                "subject_token",
                                                                SUBJECT_TOKEN))))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .extracting(
                        exception ->
                                ((OAuth2AuthenticationException) exception)
                                        .getError()
                                        .getErrorCode())
                .isEqualTo("invalid_grant");
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
            OAuth2ClientAuthenticationToken client, Map<String, Object> parameters) {
        return new UmaTicketAuthenticationToken(client, parameters);
    }

    private static OAuth2ClientAuthenticationToken authenticatedClient() {
        RegisteredClient client =
                RegisteredClient.withId("client-entity-id")
                        .clientId(CLIENT_ID)
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(
                                new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                        AuthorizationGrantTypes.UMA_TICKET))
                        .scope("uma_authorization")
                        .build();
        return new OAuth2ClientAuthenticationToken(
                client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "unused-secret");
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
        resource.setName("Orders");
        return resource;
    }

    private static AuthorizationPermissionEntity permission(String scopeName) {
        AuthorizationPermissionEntity permission = new AuthorizationPermissionEntity();
        permission.setScopeName(scopeName);
        permission.setDecisionStrategy("AFFIRMATIVE");
        AuthorizationPolicyEntity policy = new AuthorizationPolicyEntity();
        policy.setType("PUBLIC");
        policy.setEffect("ALLOW");
        permission.setPolicies(new LinkedHashSet<>(List.of(policy)));
        return permission;
    }

    private static AuthorizationEntity authorization() {
        AuthorizationEntity authorization = new AuthorizationEntity();
        authorization.setRegisteredClientId("client-entity-id");
        authorization.setPrincipalName("alice");
        authorization.setAccessTokenExpiresAt(Instant.now().plusSeconds(60));
        return authorization;
    }

    private static Jwt.Builder jwt(String tokenValue, String subject) {
        Instant now = Instant.now();
        return Jwt.withTokenValue(tokenValue)
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300));
    }
}
