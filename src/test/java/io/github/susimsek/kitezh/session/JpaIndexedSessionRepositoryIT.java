package io.github.susimsek.kitezh.session;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.IntegrationTest;
import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

@IntegrationTest
class JpaIndexedSessionRepositoryIT {

    @Autowired private JpaIndexedSessionRepository sessionRepository;

    @AfterEach
    void clearCurrentSessionIfPresent() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void keepsSecurityContextAcrossConsecutiveSessionSaves() {
        JpaSession session = sessionRepository.createSession();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin", "N/A", AuthorityUtils.createAuthorityList("ROLE_ADMIN")));
        session.setAttribute("SPRING_SECURITY_CONTEXT", context);
        sessionRepository.save(session);

        JpaSession firstRead = sessionRepository.findById(session.getId());
        assertThat(firstRead).isNotNull();
        firstRead.setAttribute("authorization-request", "first");
        sessionRepository.save(firstRead);

        JpaSession secondRead = sessionRepository.findById(session.getId());
        assertThat(secondRead).isNotNull();
        assertThat(secondRead.isExpired()).isFalse();
        assertThat(secondRead.<SecurityContext>getAttribute("SPRING_SECURITY_CONTEXT"))
                .extracting(SecurityContext::getAuthentication)
                .extracting(Principal::getName)
                .isEqualTo("admin");

        sessionRepository.deleteById(session.getId());
    }

    @Test
    void findsSessionsByPrincipalAndPersistsSessionIdChanges() {
        String username = "session-id-rotation-user";
        JpaSession session = sessionRepository.createSession();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        username, "N/A", AuthorityUtils.createAuthorityList("ROLE_ADMIN")));
        session.setAttribute("SPRING_SECURITY_CONTEXT", context);
        sessionRepository.save(session);

        assertThat(
                        sessionRepository.findByIndexNameAndIndexValue(
                                JpaIndexedSessionRepository.PRINCIPAL_NAME_INDEX_NAME, username))
                .containsKey(session.getId());

        JpaSession reloaded = sessionRepository.findById(session.getId());
        String originalId = reloaded.getId();
        reloaded.setAttribute("authorization-request", "changed");
        String changedId = reloaded.changeSessionId();
        sessionRepository.save(reloaded);

        assertThat(sessionRepository.findById(originalId)).isNull();
        assertThat(sessionRepository.findById(changedId)).isNotNull();
        assertThat(
                        sessionRepository.findByIndexNameAndIndexValue(
                                JpaIndexedSessionRepository.PRINCIPAL_NAME_INDEX_NAME, username))
                .containsOnlyKeys(changedId);
        assertThat(
                        sessionRepository
                                .findById(changedId)
                                .<String>getAttribute("authorization-request"))
                .isEqualTo("changed");

        sessionRepository.deleteById(changedId);
    }

    @Test
    void deletesExpiredSessionsOnReadAndOnScheduledCleanup() {
        JpaSession expiredOnRead = sessionRepository.createSession();
        expiredOnRead.setMaxInactiveInterval(Duration.ofSeconds(1));
        expiredOnRead.setLastAccessedTime(Instant.now().minusSeconds(5));
        sessionRepository.save(expiredOnRead);

        JpaSession expiredForCleanup = sessionRepository.createSession();
        expiredForCleanup.setMaxInactiveInterval(Duration.ofSeconds(1));
        expiredForCleanup.setLastAccessedTime(Instant.now().minusSeconds(5));
        sessionRepository.save(expiredForCleanup);

        JpaSession active = sessionRepository.createSession();
        active.setAttribute("name", "active");
        sessionRepository.save(active);

        assertThat(sessionRepository.findById(expiredOnRead.getId())).isNull();

        sessionRepository.cleanUpExpiredSessions();

        assertThat(sessionRepository.findById(expiredForCleanup.getId())).isNull();
        assertThat(sessionRepository.findById(active.getId())).isNotNull();

        sessionRepository.deleteById(active.getId());
    }
}
