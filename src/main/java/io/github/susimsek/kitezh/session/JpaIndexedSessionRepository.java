package io.github.susimsek.kitezh.session;

import io.github.susimsek.kitezh.domain.UserSessionEntity;
import io.github.susimsek.kitezh.repository.UserSessionRepository;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.session.DelegatingIndexResolver;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.FlushMode;
import org.springframework.session.IndexResolver;
import org.springframework.session.MapSession;
import org.springframework.session.PrincipalNameIndexResolver;
import org.springframework.session.SaveMode;
import org.springframework.session.Session;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.Assert;

public class JpaIndexedSessionRepository implements FindByIndexNameSessionRepository<JpaSession> {

    private final UserSessionRepository sessionRepository;
    private final JpaSessionMapper sessionMapper;
    private final TransactionTemplate transactionTemplate;
    private IndexResolver<Session> indexResolver =
            new DelegatingIndexResolver<>(new PrincipalNameIndexResolver<>());

    private Duration defaultMaxInactiveInterval = MapSession.DEFAULT_MAX_INACTIVE_INTERVAL;
    private FlushMode flushMode = FlushMode.ON_SAVE;
    private SaveMode saveMode = SaveMode.ON_SET_ATTRIBUTE;

    public JpaIndexedSessionRepository(
            UserSessionRepository sessionRepository,
            PlatformTransactionManager transactionManager,
            JpaSessionMapper sessionMapper) {
        this.sessionRepository = sessionRepository;
        this.sessionMapper = sessionMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(
                TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public JpaSession createSession() {
        MapSession delegate = new MapSession();
        delegate.setMaxInactiveInterval(defaultMaxInactiveInterval);
        JpaSession session = new JpaSession(delegate, UUID.randomUUID().toString(), this, true);
        if (flushMode == FlushMode.IMMEDIATE) {
            save(session);
        }
        return session;
    }

    @Override
    public void save(JpaSession session) {
        transactionTemplate.executeWithoutResult(status -> saveInTransaction(session));
        session.markPersisted();
    }

    @Override
    public JpaSession findById(String id) {
        return transactionTemplate.execute(
                status -> {
                    Optional<UserSessionEntity> result = sessionRepository.findBySessionId(id);
                    if (result.isEmpty()) {
                        return null;
                    }
                    JpaSession session = toSession(result.get());
                    if (session.isExpired()) {
                        sessionRepository.deleteBySessionId(id);
                        return null;
                    }
                    return session;
                });
    }

    @Override
    public void deleteById(String id) {
        transactionTemplate.executeWithoutResult(status -> sessionRepository.deleteBySessionId(id));
    }

    @Override
    public Map<String, JpaSession> findByIndexNameAndIndexValue(
            String indexName, String indexValue) {
        if (!PRINCIPAL_NAME_INDEX_NAME.equals(indexName)) {
            return Collections.emptyMap();
        }

        List<JpaSession> sessions =
                Optional.ofNullable(
                                transactionTemplate.execute(
                                        status ->
                                                sessionRepository
                                                        .findAllByPrincipalNameAndExpiryTimeAfter(
                                                                indexValue,
                                                                System.currentTimeMillis())
                                                        .stream()
                                                        .map(this::toSession)
                                                        .toList()))
                        .orElseGet(Collections::emptyList);

        return sessions.stream().collect(Collectors.toMap(JpaSession::getId, Function.identity()));
    }

    public void cleanUpExpiredSessions() {
        transactionTemplate.executeWithoutResult(
                status -> sessionRepository.deleteExpiredSessions(System.currentTimeMillis()));
    }

    public void setDefaultMaxInactiveInterval(Duration defaultMaxInactiveInterval) {
        Assert.notNull(defaultMaxInactiveInterval, "defaultMaxInactiveInterval cannot be null");
        this.defaultMaxInactiveInterval = defaultMaxInactiveInterval;
    }

    public void setFlushMode(FlushMode flushMode) {
        Assert.notNull(flushMode, "flushMode cannot be null");
        this.flushMode = flushMode;
    }

    public void setIndexResolver(IndexResolver<Session> indexResolver) {
        Assert.notNull(indexResolver, "indexResolver cannot be null");
        this.indexResolver = indexResolver;
    }

    public void setSaveMode(SaveMode saveMode) {
        Assert.notNull(saveMode, "saveMode cannot be null");
        this.saveMode = saveMode;
    }

    void flushIfRequired(JpaSession session) {
        if (flushMode == FlushMode.IMMEDIATE) {
            save(session);
        }
    }

    void attributeRead(JpaSession session, String attributeName, Object attributeValue) {
        if (saveMode == SaveMode.ON_GET_ATTRIBUTE && attributeValue != null) {
            session.getDelta().put(attributeName, attributeValue);
        }
    }

    private void saveInTransaction(JpaSession session) {
        UserSessionEntity entity = findEntityForSave(session).orElseGet(UserSessionEntity::new);
        entity.setPrimaryId(session.getPrimaryKey());
        sessionMapper.updateEntity(
                entity,
                session,
                indexResolver
                        .resolveIndexesFor(session.getDelegate())
                        .get(PRINCIPAL_NAME_INDEX_NAME),
                session.isNew() || saveMode == SaveMode.ALWAYS);

        sessionRepository.save(entity);
    }

    private Optional<UserSessionEntity> findEntityForSave(JpaSession session) {
        return session.isNew()
                ? Optional.empty()
                : sessionRepository.findByPrimaryIdForUpdate(session.getPrimaryKey());
    }

    private JpaSession toSession(UserSessionEntity entity) {
        return sessionMapper.toSession(entity, this);
    }
}
