package io.github.susimsek.kitezh.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_session")
public class UserSessionEntity {

    @Id
    @Column(name = "primary_id", nullable = false, length = 36)
    private String primaryId;

    @Column(name = "session_id", nullable = false, unique = true, length = 36)
    private String sessionId;

    @Column(name = "creation_time", nullable = false)
    private long creationTime;

    @Column(name = "last_access_time", nullable = false)
    private long lastAccessTime;

    @Column(name = "max_inactive_interval", nullable = false)
    private int maxInactiveInterval;

    @Column(name = "expiry_time", nullable = false)
    private long expiryTime;

    @Column(name = "principal_name", length = 100)
    private String principalName;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "user_session_attributes",
            joinColumns = @JoinColumn(name = "session_primary_id"))
    @MapKeyColumn(name = "attribute_name", length = 200)
    @Column(name = "attribute_bytes", nullable = false)
    private Map<String, byte[]> attributes = new LinkedHashMap<>();
}
