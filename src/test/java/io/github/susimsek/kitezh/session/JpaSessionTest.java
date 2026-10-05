package io.github.susimsek.kitezh.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.session.MapSession;

@ExtendWith(MockitoExtension.class)
class JpaSessionTest {

    @Mock private JpaIndexedSessionRepository repository;

    @Test
    void mutatingOperationsTrackDeltaAndRequestFlushes() {
        MapSession delegate = new MapSession();
        JpaSession session = new JpaSession(delegate, "primary-id", repository, true);
        Instant lastAccessedTime = Instant.now().minusSeconds(30);
        Duration maxInactiveInterval = Duration.ofMinutes(10);

        session.setAttribute("alpha", "one");
        session.setLastAccessedTime(lastAccessedTime);
        session.setMaxInactiveInterval(maxInactiveInterval);
        String originalId = session.getId();
        String changedId = session.changeSessionId();
        session.removeAttribute("alpha");

        assertThat(originalId).isNotEqualTo(changedId);
        assertThat(changedId).isEqualTo(session.getId());
        assertThat(session.getLastAccessedTime()).isEqualTo(lastAccessedTime);
        assertThat(session.getMaxInactiveInterval()).isEqualTo(maxInactiveInterval);
        assertThat(session.getDelta()).containsEntry("alpha", null);
        verify(repository, times(5)).flushIfRequired(session);
    }

    @Test
    void getAttributeDelegatesReadTrackingAndMarkPersistedResetsState() {
        MapSession delegate = new MapSession();
        delegate.setAttribute("alpha", "one");
        JpaSession session = new JpaSession(delegate, "primary-id", repository, true);

        assertThat(session.<String>getAttribute("alpha")).isEqualTo("one");
        verify(repository).attributeRead(session, "alpha", "one");

        session.setAttribute("beta", "two");
        session.changeSessionId();
        session.markPersisted();

        assertThat(session.isNew()).isFalse();
        assertThat(session.getOriginalId()).isEqualTo(session.getId());
        assertThat(session.getDelta()).isEmpty();
    }
}
