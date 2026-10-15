package io.github.susimsek.kitezh.service.authz;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.AuthorizationPolicyEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class AuthorizationPolicyEvaluatorTest {

    private final AuthorizationPolicyEvaluator evaluator = new AuthorizationPolicyEvaluator();

    @Test
    void grantsMatchingUserAndRolePolicies() {
        assertThat(
                        evaluator.isGranted(
                                List.of(policy("USER", "alice", "ALLOW")),
                                "AFFIRMATIVE",
                                resource("owner"),
                                user("alice")))
                .isTrue();
        assertThat(
                        evaluator.isGranted(
                                List.of(policy("ROLE", "ROLE_EDITOR", "ALLOW")),
                                "AFFIRMATIVE",
                                resource("owner"),
                                user("alice", "ROLE_EDITOR")))
                .isTrue();
    }

    @Test
    void deniesWhenNoPolicyMatchesOrMatchingDenyExists() {
        assertThat(
                        evaluator.isGranted(
                                List.of(policy("USER", "bob", "ALLOW")),
                                "AFFIRMATIVE",
                                resource("owner"),
                                user("alice")))
                .isFalse();
        assertThat(
                        evaluator.isGranted(
                                List.of(
                                        policy("USER", "alice", "ALLOW"),
                                        policy("USER", "alice", "DENY")),
                                "AFFIRMATIVE",
                                resource("owner"),
                                user("alice")))
                .isFalse();
    }

    @Test
    void appliesUnanimousAndConsensusStrategies() {
        List<AuthorizationPolicyEntity> policies =
                List.of(
                        policy("USER", "alice", "ALLOW"),
                        policy("ROLE", "ROLE_EDITOR", "ALLOW"),
                        policy("USER", "bob", "DENY"));
        Authentication subject = user("alice", "ROLE_EDITOR");

        assertThat(evaluator.isGranted(policies, "UNANIMOUS", resource("owner"), subject))
                .isFalse();
        assertThat(evaluator.isGranted(policies, "CONSENSUS", resource("owner"), subject)).isTrue();
    }

    @Test
    void ownerAndPublicPoliciesMatchAuthenticatedSubjects() {
        assertThat(
                        evaluator.isGranted(
                                List.of(policy("OWNER", null, "ALLOW")),
                                "AFFIRMATIVE",
                                resource("alice"),
                                user("alice")))
                .isTrue();
        assertThat(
                        evaluator.isGranted(
                                List.of(policy("PUBLIC", null, "ALLOW")),
                                "AFFIRMATIVE",
                                resource("alice"),
                                user("bob")))
                .isTrue();
    }

    private static AuthorizationPolicyEntity policy(String type, String value, String effect) {
        AuthorizationPolicyEntity policy = new AuthorizationPolicyEntity();
        policy.setType(type);
        policy.setSubjectValue(value);
        policy.setEffect(effect);
        return policy;
    }

    private static AuthorizationResourceEntity resource(String owner) {
        AuthorizationResourceEntity resource = new AuthorizationResourceEntity();
        resource.setOwnerSubject(owner);
        return resource;
    }

    private static Authentication user(String username, String... authorities) {
        return UsernamePasswordAuthenticationToken.authenticated(
                username,
                null,
                java.util.Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList());
    }
}
