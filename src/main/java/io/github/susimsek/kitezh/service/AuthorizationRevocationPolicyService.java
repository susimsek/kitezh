package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.AuthorizationRevocationPolicyEntity;
import io.github.susimsek.kitezh.repository.AuthorizationRevocationPolicyRepository;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Manages application, user, and client token not-before policies without a realm boundary. */
@Service
@RequiredArgsConstructor
public class AuthorizationRevocationPolicyService {

    public static final String APPLICATION_SCOPE = "application";
    public static final String USER_SCOPE = "user";
    public static final String CLIENT_SCOPE = "client";
    private static final String APPLICATION_KEY = "default";

    private final AuthorizationRevocationPolicyRepository repository;

    @Transactional
    public Instant revokeApplication() {
        return revoke(APPLICATION_SCOPE, APPLICATION_KEY);
    }

    @Transactional
    public Instant revokeUser(String username) {
        return revoke(USER_SCOPE, username);
    }

    @Transactional
    public Instant revokeClient(String clientId) {
        return revoke(CLIENT_SCOPE, clientId);
    }

    @Transactional(readOnly = true)
    public boolean isRevoked(Jwt token) {
        return isRevoked(
                token.getSubject(), token.getClaimAsString("client_id"), token.getIssuedAt());
    }

    @Transactional(readOnly = true)
    public boolean isRevoked(String username, String clientId, Instant issuedAt) {
        if (issuedAt == null) {
            return false;
        }
        List<String> policyIds =
                Stream.of(
                                policyId(APPLICATION_SCOPE, APPLICATION_KEY),
                                username == null ? null : policyId(USER_SCOPE, username),
                                clientId == null ? null : policyId(CLIENT_SCOPE, clientId))
                        .filter(Objects::nonNull)
                        .toList();
        return repository.findAllById(policyIds).stream()
                .anyMatch(policy -> issuedAt.isBefore(policy.getRevokedBefore()));
    }

    private Instant revoke(String scopeType, String scopeKey) {
        Instant revokedBefore = Instant.now();
        String id = policyId(scopeType, scopeKey);
        AuthorizationRevocationPolicyEntity entity =
                repository
                        .findById(id)
                        .orElseGet(
                                () ->
                                        new AuthorizationRevocationPolicyEntity(
                                                id, scopeType, scopeKey, revokedBefore));
        entity.setRevokedBefore(revokedBefore);
        repository.save(entity);
        return revokedBefore;
    }

    private static String policyId(String scopeType, String scopeKey) {
        return scopeType + ":" + scopeKey;
    }
}
