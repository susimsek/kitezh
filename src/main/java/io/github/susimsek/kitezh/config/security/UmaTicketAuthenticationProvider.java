package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import io.github.susimsek.kitezh.domain.AuthorizationPermissionEntity;
import io.github.susimsek.kitezh.domain.AuthorizationPermissionTicketEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionRepository;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionTicketRepository;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceRepository;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.service.authz.AuthorizationPolicyEvaluator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.DefaultOAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Validates UMA tickets and issues signed RPT access tokens with evaluated permissions. */
@Component
@RequiredArgsConstructor
public class UmaTicketAuthenticationProvider implements AuthenticationProvider {

    private static final String TICKET = "ticket";
    private static final String SUBJECT_TOKEN = "subject_token";
    private static final String UMA_AUTHORIZATION_SCOPE = "uma_authorization";
    private static final AuthorizationGrantType GRANT_TYPE =
            new AuthorizationGrantType(AuthorizationGrantTypes.UMA_TICKET);

    private final AuthorizationPermissionTicketRepository ticketRepository;
    private final AuthorizationResourceRepository resourceRepository;
    private final AuthorizationPermissionRepository permissionRepository;
    private final AuthorizationRepository authorizationRepository;
    private final OAuth2AuthorizationService authorizationService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;
    private final UserDetailsService userDetailsService;
    private final JwtDecoder jwtDecoder;
    private final AuthorizationPolicyEvaluator policyEvaluator;

    @Override
    @Transactional
    public Authentication authenticate(Authentication authentication)
            throws AuthenticationException {
        UmaTicketAuthenticationToken request = (UmaTicketAuthenticationToken) authentication;
        OAuth2ClientAuthenticationToken clientPrincipal = authenticatedClient(request);
        RegisteredClient client = clientPrincipal.getRegisteredClient();
        if (!client.getAuthorizationGrantTypes().contains(GRANT_TYPE)) {
            throw error(OAuth2ErrorCodes.UNAUTHORIZED_CLIENT, "UMA ticket grant is not enabled");
        }
        if (!client.getScopes().contains(UMA_AUTHORIZATION_SCOPE)) {
            throw error(
                    OAuth2ErrorCodes.INVALID_SCOPE,
                    "Client is not configured for UMA authorization");
        }

        String rawTicket = (String) request.getAdditionalParameters().get(TICKET);
        AuthorizationPermissionTicketEntity ticket =
                ticketRepository
                        .findById(UmaTicketTokens.digest(rawTicket))
                        .filter(value -> value.getExpiresAt().isAfter(Instant.now()))
                        .orElseThrow(
                                () ->
                                        error(
                                                OAuth2ErrorCodes.INVALID_GRANT,
                                                "Permission ticket is invalid or expired"));
        AuthorizationResourceEntity resource =
                resourceRepository
                        .findById(ticket.getResourceId())
                        .orElseThrow(
                                () ->
                                        error(
                                                OAuth2ErrorCodes.INVALID_GRANT,
                                                "Permission ticket resource no longer exists"));
        Authentication subject = resolveSubject(request, clientPrincipal, client.getId());
        boolean includeResourceName =
                Boolean.TRUE.equals(
                        request.getAdditionalParameters().get("response_include_resource_name"));
        List<Map<String, Object>> granted =
                evaluate(ticket, resource, subject, includeResourceName);
        if (granted.isEmpty()) {
            throw error(OAuth2ErrorCodes.ACCESS_DENIED, "No requested permissions were granted");
        }
        UmaTicketAuthenticationToken tokenGrant =
                new UmaTicketAuthenticationToken(
                        clientPrincipal,
                        Map.of(
                                UmaTicketAuthenticationToken.AUTHORIZATION_PERMISSIONS,
                                granted,
                                "resource_server_client_id",
                                ticket.getResourceServerClientId()));
        OAuth2TokenContext tokenContext =
                DefaultOAuth2TokenContext.builder()
                        .registeredClient(client)
                        .principal(subject)
                        .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                        .authorizedScopes(Set.of(UMA_AUTHORIZATION_SCOPE))
                        .tokenType(OAuth2TokenType.ACCESS_TOKEN)
                        .authorizationGrantType(GRANT_TYPE)
                        .authorizationGrant(tokenGrant)
                        .build();
        OAuth2Token generated = tokenGenerator.generate(tokenContext);
        if (!(generated instanceof Jwt jwt)) {
            throw error(
                    OAuth2ErrorCodes.SERVER_ERROR,
                    "UMA requesting party tokens must use a signed JWT access-token format");
        }
        OAuth2AccessToken accessToken =
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        jwt.getTokenValue(),
                        jwt.getIssuedAt(),
                        jwt.getExpiresAt(),
                        Set.of(UMA_AUTHORIZATION_SCOPE));
        OAuth2Authorization.Builder authorizationBuilder =
                OAuth2Authorization.withRegisteredClient(client)
                        .principalName(subject.getName())
                        .authorizationGrantType(GRANT_TYPE)
                        .authorizedScopes(Set.of(UMA_AUTHORIZATION_SCOPE))
                        .token(
                                accessToken,
                                metadata ->
                                        metadata.put(
                                                OAuth2Authorization.Token.CLAIMS_METADATA_NAME,
                                                jwt.getClaims()));
        authorizationService.save(authorizationBuilder.build());
        ticketRepository.delete(ticket);
        return new OAuth2AccessTokenAuthenticationToken(
                client, clientPrincipal, accessToken, null, Map.of());
    }

    private Authentication resolveSubject(
            UmaTicketAuthenticationToken request,
            OAuth2ClientAuthenticationToken clientPrincipal,
            String registeredClientId) {
        Object subjectTokenValue = request.getAdditionalParameters().get(SUBJECT_TOKEN);
        if (!(subjectTokenValue instanceof String subjectToken)) {
            return clientPrincipal;
        }
        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(subjectToken);
        } catch (RuntimeException _) {
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Subject access token is invalid");
        }
        AuthorizationEntity authorization =
                authorizationRepository
                        .findByAccessTokenValue(subjectToken)
                        .filter(value -> value.getAccessTokenExpiresAt() != null)
                        .filter(value -> value.getAccessTokenExpiresAt().isAfter(Instant.now()))
                        .filter(value -> value.getRegisteredClientId().equals(registeredClientId))
                        .orElseThrow(
                                () ->
                                        error(
                                                OAuth2ErrorCodes.INVALID_GRANT,
                                                "Subject access token is not active for this"
                                                        + " client"));
        if (!authorization.getPrincipalName().equals(jwt.getSubject())) {
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Subject access token is invalid");
        }
        UserDetails user = userDetailsService.loadUserByUsername(authorization.getPrincipalName());
        List<GrantedAuthority> authorities = new ArrayList<>(user.getAuthorities());
        List<String> groups = jwt.getClaimAsStringList("groups");
        if (groups != null) {
            groups.stream()
                    .map(group -> new SimpleGrantedAuthority("GROUP_" + group))
                    .forEach(authorities::add);
        }
        return UsernamePasswordAuthenticationToken.authenticated(
                user.getUsername(), null, authorities);
    }

    private List<Map<String, Object>> evaluate(
            AuthorizationPermissionTicketEntity ticket,
            AuthorizationResourceEntity resource,
            Authentication subject,
            boolean includeResourceName) {
        Set<String> requestedScopes =
                java.util.Arrays.stream(ticket.getRequestedScopes().split(" "))
                        .filter(value -> !value.isBlank())
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        List<AuthorizationPermissionEntity> permissions =
                permissionRepository.findWithPoliciesByResourceId(resource.getId());
        List<Map<String, Object>> granted = new ArrayList<>();
        for (String scope : requestedScopes) {
            boolean grantedForScope =
                    permissions.stream()
                            .filter(
                                    permission ->
                                            permission.getScopeName() == null
                                                    || permission.getScopeName().equals(scope))
                            .filter(
                                    permission ->
                                            policyEvaluator.isGranted(
                                                    permission.getPolicies(),
                                                    permission.getDecisionStrategy(),
                                                    resource,
                                                    subject))
                            .findAny()
                            .isPresent();
            if (grantedForScope) {
                Map<String, Object> result = new HashMap<>();
                result.put("resource_set_id", resource.getId());
                result.put("scopes", List.of(scope));
                if (includeResourceName) {
                    result.put("resource_set_name", resource.getName());
                }
                granted.add(Map.copyOf(result));
            }
        }
        return List.copyOf(granted);
    }

    private static OAuth2ClientAuthenticationToken authenticatedClient(
            UmaTicketAuthenticationToken request) {
        if (request.getPrincipal() instanceof OAuth2ClientAuthenticationToken client
                && client.isAuthenticated()
                && client.getRegisteredClient() != null) {
            return client;
        }
        throw error(OAuth2ErrorCodes.INVALID_CLIENT, "Client authentication is required");
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UmaTicketAuthenticationToken.class.isAssignableFrom(authentication);
    }

    private static OAuth2AuthenticationException error(String code, String description) {
        return new OAuth2AuthenticationException(new OAuth2Error(code, description, null));
    }
}
