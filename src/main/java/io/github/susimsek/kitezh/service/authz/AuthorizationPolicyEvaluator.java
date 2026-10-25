package io.github.susimsek.kitezh.service.authz;

import io.github.susimsek.kitezh.domain.AuthorizationPolicyEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Evaluates Authorization Services policies without consulting administrative authorities. */
@Component
public class AuthorizationPolicyEvaluator {

    public boolean isGranted(
            Collection<AuthorizationPolicyEntity> policies,
            String decisionStrategy,
            AuthorizationResourceEntity resource,
            Authentication subject) {
        if (policies == null
                || policies.isEmpty()
                || subject == null
                || !subject.isAuthenticated()) {
            return false;
        }
        List<PolicyResult> results =
                policies.stream().map(policy -> evaluate(policy, resource, subject)).toList();
        long allowed =
                results.stream()
                        .filter(result -> result.effect().equals("ALLOW") && result.matches())
                        .count();
        long denied =
                results.stream()
                        .filter(result -> result.effect().equals("DENY") && result.matches())
                        .count();
        return switch (decisionStrategy.toUpperCase(Locale.ROOT)) {
            case "UNANIMOUS" -> allowed == policies.size();
            case "CONSENSUS" -> allowed > 0 && allowed > denied;
            default -> allowed > 0 && denied == 0;
        };
    }

    private static PolicyResult evaluate(
            AuthorizationPolicyEntity policy,
            AuthorizationResourceEntity resource,
            Authentication subject) {
        String subjectValue = policy.getSubjectValue();
        boolean matches =
                switch (policy.getType()) {
                    case "PUBLIC" -> true;
                    case "OWNER" -> resource.getOwnerSubject().equals(subject.getName());
                    case "USER" -> subject.getName().equals(subjectValue);
                    case "CLIENT" -> clientId(subject).equals(subjectValue);
                    case "ROLE" ->
                            subject.getAuthorities().stream()
                                    .anyMatch(
                                            authority ->
                                                    authority.getAuthority().equals(subjectValue));
                    case "GROUP" -> inGroups(subject, subjectValue);
                    default -> false;
                };
        return new PolicyResult(policy.getEffect(), matches);
    }

    private static String clientId(Authentication subject) {
        if (subject instanceof JwtAuthenticationToken jwtAuthentication) {
            String clientId = jwtAuthentication.getToken().getClaimAsString("client_id");
            if (clientId != null) {
                return clientId;
            }
        }
        return subject.getName();
    }

    private static boolean inGroups(Authentication subject, String groupName) {
        if (subject instanceof JwtAuthenticationToken jwtAuthentication) {
            List<String> groups = jwtAuthentication.getToken().getClaimAsStringList("groups");
            if (groups != null && groups.contains(groupName)) {
                return true;
            }
        }
        return subject.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("GROUP_" + groupName));
    }

    private record PolicyResult(String effect, boolean matches) {}
}
