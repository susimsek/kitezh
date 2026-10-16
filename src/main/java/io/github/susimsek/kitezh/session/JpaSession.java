package io.github.susimsek.kitezh.session;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.session.MapSession;
import org.springframework.session.Session;

public final class JpaSession implements Session {

    private final MapSession delegate;
    private final JpaIndexedSessionRepository repository;
    private final String primaryKey;
    private final Map<String, Object> delta = new LinkedHashMap<>();
    private String originalId;
    private boolean isNew;

    JpaSession(
            MapSession delegate,
            String primaryKey,
            JpaIndexedSessionRepository repository,
            boolean isNew) {
        this.delegate = delegate;
        this.primaryKey = primaryKey;
        this.repository = repository;
        this.originalId = delegate.getId();
        this.isNew = isNew;
    }

    String getOriginalId() {
        return originalId;
    }

    String getPrimaryKey() {
        return primaryKey;
    }

    boolean isNew() {
        return isNew;
    }

    Map<String, Object> getDelta() {
        return delta;
    }

    void markPersisted() {
        originalId = getId();
        isNew = false;
        delta.clear();
    }

    MapSession getDelegate() {
        return delegate;
    }

    void setLoadedAttribute(String attributeName, Object attributeValue) {
        delegate.setAttribute(attributeName, attributeValue);
    }

    void removeLoadedAttribute(String attributeName) {
        delegate.removeAttribute(attributeName);
        delta.put(attributeName, null);
    }

    @Override
    public String getId() {
        return delegate.getId();
    }

    @Override
    public String changeSessionId() {
        String id = delegate.changeSessionId();
        repository.flushIfRequired(this);
        return id;
    }

    @Override
    public Instant getCreationTime() {
        return delegate.getCreationTime();
    }

    @Override
    public Instant getLastAccessedTime() {
        return delegate.getLastAccessedTime();
    }

    @Override
    public void setLastAccessedTime(Instant lastAccessedTime) {
        delegate.setLastAccessedTime(lastAccessedTime);
        repository.flushIfRequired(this);
    }

    @Override
    public Duration getMaxInactiveInterval() {
        return delegate.getMaxInactiveInterval();
    }

    @Override
    public void setMaxInactiveInterval(Duration interval) {
        delegate.setMaxInactiveInterval(interval);
        repository.flushIfRequired(this);
    }

    @Override
    public boolean isExpired() {
        return delegate.isExpired();
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T getAttribute(String attributeName) {
        T value = delegate.getAttribute(attributeName);
        repository.attributeRead(this, attributeName, value);
        return value;
    }

    @Override
    public Set<String> getAttributeNames() {
        return delegate.getAttributeNames();
    }

    @Override
    public void setAttribute(String attributeName, Object attributeValue) {
        delegate.setAttribute(attributeName, attributeValue);
        delta.put(attributeName, attributeValue);
        repository.flushIfRequired(this);
    }

    @Override
    public void removeAttribute(String attributeName) {
        delegate.removeAttribute(attributeName);
        delta.put(attributeName, null);
        repository.flushIfRequired(this);
    }
}
