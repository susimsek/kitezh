package io.github.susimsek.kitezh.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.config.session.SessionConfig;
import io.github.susimsek.kitezh.domain.UserSessionEntity;
import io.github.susimsek.kitezh.repository.UserSessionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.FlushMode;
import org.springframework.session.SaveMode;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JpaIndexedSessionRepositoryTest {

    @Mock private UserSessionRepository userSessionRepository;

    private final InMemorySessionStore store = new InMemorySessionStore();
    private JpaIndexedSessionRepository repository;

    @BeforeEach
    void setUp() {
        repository =
                new JpaIndexedSessionRepository(
                        userSessionRepository,
                        new NoOpTransactionManager(),
                        new JpaSessionMapper(
                                new SessionConfig()
                                        .springSessionConversionService(
                                                new SecurityJsonMapper(
                                                        getClass().getClassLoader()))));

        lenient()
                .when(userSessionRepository.findBySessionId(anyString()))
                .thenAnswer(invocation -> store.findBySessionId(invocation.getArgument(0)));
        lenient()
                .when(userSessionRepository.findByPrimaryIdForUpdate(anyString()))
                .thenAnswer(invocation -> store.findByPrimaryId(invocation.getArgument(0)));
        lenient()
                .when(
                        userSessionRepository.findAllByPrincipalNameAndExpiryTimeAfter(
                                anyString(), anyLong()))
                .thenAnswer(
                        invocation ->
                                store.findAllByPrincipalNameAndExpiryTimeAfter(
                                        invocation.getArgument(0), invocation.getArgument(1)));
        lenient()
                .when(userSessionRepository.save(any(UserSessionEntity.class)))
                .thenAnswer(invocation -> store.save(invocation.getArgument(0)));
        lenient()
                .when(userSessionRepository.deleteBySessionId(anyString()))
                .thenAnswer(invocation -> store.deleteBySessionId(invocation.getArgument(0)));
        lenient()
                .when(userSessionRepository.deleteExpiredSessions(anyLong()))
                .thenAnswer(invocation -> store.deleteExpiredSessions(invocation.getArgument(0)));
    }

    @Test
    void saveAndFindByIdPersistPrincipalAttributesAndIndexLookup() {
        JpaSession session = repository.createSession();
        session.setAttribute("alpha", "one");
        session.setAttribute("SPRING_SECURITY_CONTEXT", securityContext("admin"));

        repository.save(session);

        assertThat(store.findBySessionId(session.getId()).orElseThrow().getPrimaryId())
                .isNotEqualTo(session.getId());

        JpaSession reloaded = repository.findById(session.getId());

        assertThat(reloaded).isNotNull();
        assertThat(reloaded.isNew()).isFalse();
        assertThat(reloaded.<String>getAttribute("alpha")).isEqualTo("one");
        assertThat(
                        repository.findByIndexNameAndIndexValue(
                                FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME,
                                "admin"))
                .containsOnlyKeys(session.getId());
        assertThat(repository.findByIndexNameAndIndexValue("unknown", "admin")).isEmpty();
    }

    @Test
    void saveUpdatesExistingEntityWhenSessionIdChanges() {
        JpaSession session = repository.createSession();
        session.setAttribute("alpha", "one");
        repository.save(session);

        final String primaryId =
                store.findBySessionId(session.getId()).orElseThrow().getPrimaryId();

        JpaSession reloaded = repository.findById(session.getId());
        reloaded.setAttribute("alpha", "two");
        reloaded.setAttribute("beta", "three");
        reloaded.removeAttribute("beta");
        String originalId = reloaded.getOriginalId();
        String changedId = reloaded.changeSessionId();

        repository.save(reloaded);

        assertThat(repository.findById(originalId)).isNull();
        assertThat(repository.findById(changedId)).isNotNull();
        assertThat(repository.findById(changedId).<String>getAttribute("alpha")).isEqualTo("two");
        assertThat((Object) repository.findById(changedId).getAttribute("beta")).isNull();
        assertThat(store.findBySessionId(changedId).orElseThrow().getPrimaryId())
                .isEqualTo(primaryId);
    }

    @Test
    void findByIdDeletesExpiredSessionsAndCleanupRemovesRemainingExpiredRows() {
        JpaSession expiredOnRead = repository.createSession();
        expiredOnRead.setMaxInactiveInterval(Duration.ofSeconds(1));
        expiredOnRead.setLastAccessedTime(Instant.now().minusSeconds(5));
        repository.save(expiredOnRead);

        JpaSession expiredForCleanup = repository.createSession();
        expiredForCleanup.setMaxInactiveInterval(Duration.ofSeconds(1));
        expiredForCleanup.setLastAccessedTime(Instant.now().minusSeconds(5));
        repository.save(expiredForCleanup);

        JpaSession active = repository.createSession();
        active.setAttribute("alpha", "active");
        repository.save(active);

        assertThat(repository.findById(expiredOnRead.getId())).isNull();

        repository.cleanUpExpiredSessions();

        assertThat(repository.findById(expiredForCleanup.getId())).isNull();
        assertThat(repository.findById(active.getId())).isNotNull();
    }

    @Test
    void immediateFlushAndReadTrackingHonorConfiguredModes() {
        repository.setFlushMode(FlushMode.IMMEDIATE);
        repository.setSaveMode(SaveMode.ON_GET_ATTRIBUTE);

        JpaSession session = repository.createSession();
        String id = session.getId();

        assertThat(repository.findById(id)).isNotNull();
        assertThat(repository.findById(id).isNew()).isFalse();

        JpaSession reloaded = repository.findById(id);
        reloaded.setAttribute("alpha", "one");
        repository.save(reloaded);

        JpaSession forRead = repository.findById(id);
        assertThat(forRead.<String>getAttribute("alpha")).isEqualTo("one");
        assertThat(forRead.getDelta()).containsEntry("alpha", "one");
    }

    @Test
    void settersRejectNulls() {
        assertThatThrownBy(() -> repository.setDefaultMaxInactiveInterval(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("defaultMaxInactiveInterval");
        assertThatThrownBy(() -> repository.setFlushMode(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("flushMode");
        assertThatThrownBy(() -> repository.setIndexResolver(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("indexResolver");
        assertThatThrownBy(() -> repository.setSaveMode(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("saveMode");
    }

    @Test
    void negativeMaxInactiveIntervalUsesLongMaxExpiry() {
        JpaSession session = repository.createSession();
        session.setMaxInactiveInterval(Duration.ofSeconds(-1));

        repository.save(session);

        assertThat(store.findBySessionId(session.getId()))
                .get()
                .extracting(UserSessionEntity::getExpiryTime)
                .isEqualTo(Long.MAX_VALUE);
    }

    @Test
    void staleSaveDoesNotRestorePreviousSessionId() {
        JpaSession session = repository.createSession();
        session.setAttribute("alpha", "one");
        repository.save(session);

        String originalId = session.getId();
        JpaSession staleRequest = repository.findById(originalId);
        JpaSession loginRequest = repository.findById(originalId);

        final String authenticatedId = loginRequest.changeSessionId();
        loginRequest.setAttribute("SPRING_SECURITY_CONTEXT", securityContext("admin"));
        repository.save(loginRequest);

        staleRequest.setAttribute("late-attribute", "preserved");
        repository.save(staleRequest);

        assertThat(repository.findById(originalId)).isNull();
        assertThat(repository.findById(authenticatedId)).isNotNull();
        assertThat(repository.findById(authenticatedId).<String>getAttribute("late-attribute"))
                .isEqualTo("preserved");
        assertThat(
                        repository
                                .findById(authenticatedId)
                                .<SecurityContext>getAttribute("SPRING_SECURITY_CONTEXT")
                                .getAuthentication()
                                .getName())
                .isEqualTo("admin");
        assertThat(
                        repository.findByIndexNameAndIndexValue(
                                FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME,
                                "admin"))
                .containsOnlyKeys(authenticatedId);
    }

    private static SecurityContext securityContext(String username) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        username, "N/A", AuthorityUtils.createAuthorityList("ROLE_ADMIN")));
        return context;
    }

    private static final class NoOpTransactionManager implements PlatformTransactionManager {

        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
            // The test transaction manager does not persist anything.
        }

        @Override
        public void rollback(TransactionStatus status) {
            // The test transaction manager does not persist anything.
        }
    }

    private static final class InMemorySessionStore {

        private final Map<String, UserSessionEntity> bySessionId = new LinkedHashMap<>();
        private final Map<String, UserSessionEntity> byPrimaryId = new LinkedHashMap<>();

        private Optional<UserSessionEntity> findBySessionId(String sessionId) {
            return Optional.ofNullable(bySessionId.get(sessionId)).map(this::copyOf);
        }

        private Optional<UserSessionEntity> findByPrimaryId(String primaryId) {
            return Optional.ofNullable(byPrimaryId.get(primaryId)).map(this::copyOf);
        }

        private List<UserSessionEntity> findAllByPrincipalNameAndExpiryTimeAfter(
                String principalName, long expiryTime) {
            return bySessionId.values().stream()
                    .filter(entity -> principalName.equals(entity.getPrincipalName()))
                    .filter(entity -> entity.getExpiryTime() > expiryTime)
                    .map(this::copyOf)
                    .toList();
        }

        private UserSessionEntity save(UserSessionEntity entity) {
            UserSessionEntity copy = copyOf(entity);
            UserSessionEntity previous = byPrimaryId.put(copy.getPrimaryId(), copy);
            if (previous != null && !previous.getSessionId().equals(copy.getSessionId())) {
                bySessionId.remove(previous.getSessionId());
            }
            bySessionId.put(copy.getSessionId(), copy);
            return copyOf(copy);
        }

        private int deleteBySessionId(String sessionId) {
            UserSessionEntity removed = bySessionId.remove(sessionId);
            if (removed == null) {
                return 0;
            }
            byPrimaryId.remove(removed.getPrimaryId());
            return 1;
        }

        private int deleteExpiredSessions(long expiryTime) {
            List<String> expiredIds =
                    bySessionId.values().stream()
                            .filter(entity -> entity.getExpiryTime() < expiryTime)
                            .map(UserSessionEntity::getSessionId)
                            .toList();
            expiredIds.forEach(this::deleteBySessionId);
            return expiredIds.size();
        }

        private UserSessionEntity copyOf(UserSessionEntity entity) {
            UserSessionEntity copy = new UserSessionEntity();
            copy.setPrimaryId(entity.getPrimaryId());
            copy.setSessionId(entity.getSessionId());
            copy.setCreationTime(entity.getCreationTime());
            copy.setLastAccessTime(entity.getLastAccessTime());
            copy.setMaxInactiveInterval(entity.getMaxInactiveInterval());
            copy.setExpiryTime(entity.getExpiryTime());
            copy.setPrincipalName(entity.getPrincipalName());
            Map<String, byte[]> attributes = new LinkedHashMap<>();
            entity.getAttributes()
                    .forEach(
                            (name, value) ->
                                    attributes.put(name, value == null ? null : value.clone()));
            copy.setAttributes(attributes);
            return copy;
        }
    }
}
