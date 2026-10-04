package io.github.susimsek.kitezh.session;

import io.github.susimsek.kitezh.domain.UserSessionEntity;
import java.time.Duration;
import java.time.Instant;
import org.springframework.core.convert.ConversionService;
import org.springframework.session.MapSession;
import org.springframework.session.Session;
import org.springframework.util.Assert;

/** Maps the JPA session schema to Spring Session's in-memory session representation. */
public final class JpaSessionMapper {

    private final ConversionService conversionService;

    public JpaSessionMapper(ConversionService conversionService) {
        Assert.notNull(conversionService, "conversionService cannot be null");
        this.conversionService = conversionService;
    }

    JpaSession toSession(UserSessionEntity entity, JpaIndexedSessionRepository repository) {
        MapSession delegate = new MapSession(entity.getSessionId());
        delegate.setCreationTime(Instant.ofEpochMilli(entity.getCreationTime()));
        delegate.setLastAccessedTime(Instant.ofEpochMilli(entity.getLastAccessTime()));
        delegate.setMaxInactiveInterval(Duration.ofSeconds(entity.getMaxInactiveInterval()));
        entity.getAttributes()
                .forEach(
                        (attributeName, bytes) ->
                                delegate.setAttribute(attributeName, deserializeAttribute(bytes)));
        return new JpaSession(delegate, entity.getPrimaryId(), repository, false);
    }

    void updateEntity(
            UserSessionEntity entity,
            JpaSession session,
            String principalName,
            boolean replaceAttributes) {
        MapSession delegate = session.getDelegate();
        boolean staleSessionId =
                entity.getSessionId() != null
                        && session.getId().equals(session.getOriginalId())
                        && !entity.getSessionId().equals(session.getOriginalId());
        if (!staleSessionId) {
            entity.setSessionId(session.getId());
            entity.setCreationTime(delegate.getCreationTime().toEpochMilli());
            entity.setLastAccessTime(delegate.getLastAccessedTime().toEpochMilli());
            entity.setMaxInactiveInterval((int) delegate.getMaxInactiveInterval().getSeconds());
            entity.setExpiryTime(expiryTime(delegate));
            entity.setPrincipalName(principalName);
        }

        if (replaceAttributes) {
            entity.getAttributes().clear();
            delegate.getAttributeNames()
                    .forEach(
                            attributeName -> {
                                Object attribute = delegate.getAttribute(attributeName);
                                if (attribute != null) {
                                    entity.getAttributes()
                                            .put(attributeName, serializeAttribute(attribute));
                                }
                            });
            return;
        }

        session.getDelta()
                .forEach(
                        (attributeName, attribute) -> {
                            if (attribute == null) {
                                entity.getAttributes().remove(attributeName);
                            } else {
                                entity.getAttributes()
                                        .put(attributeName, serializeAttribute(attribute));
                            }
                        });
    }

    private byte[] serializeAttribute(Object attribute) {
        byte[] bytes = conversionService.convert(attribute, byte[].class);
        Assert.state(bytes != null, "Session attribute serialization returned null");
        return bytes;
    }

    private Object deserializeAttribute(byte[] bytes) {
        return conversionService.convert(bytes, Object.class);
    }

    private static long expiryTime(Session session) {
        if (session.getMaxInactiveInterval().isNegative()) {
            return Long.MAX_VALUE;
        }
        return session.getLastAccessedTime().plus(session.getMaxInactiveInterval()).toEpochMilli();
    }
}
