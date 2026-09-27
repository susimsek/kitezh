package io.github.susimsek.springauthserversamples.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.proxy.HibernateProxy;

/** Persisted state for a CIBA backchannel authentication request. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "ciba_authentication_requests")
public class CibaAuthenticationRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "ciba_request_seq")
    @SequenceGenerator(
            name = "ciba_request_seq",
            sequenceName = "ciba_request_seq",
            allocationSize = 1)
    private Long id;

    @Column(name = "auth_req_id", nullable = false, unique = true, length = 128)
    private String authReqId;

    @Column(name = "registered_client_id", nullable = false, length = 100)
    private String registeredClientId;

    @Column(name = "principal_name", nullable = false, length = 200)
    private String principalName;

    @Column(name = "authorized_scopes", nullable = false, length = 1000)
    private String authorizedScopes;

    @Column(name = "binding_message", length = 20)
    private String bindingMessage;

    @Column(name = "user_code", nullable = false, unique = true, length = 32)
    private String userCode;

    @Column(name = "delivery_mode", nullable = false, length = 10)
    private String deliveryMode = "poll";

    @Column(name = "notification_endpoint", length = 2000)
    private String notificationEndpoint;

    @Column(name = "client_notification_token", length = 512)
    private String clientNotificationToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CibaAuthenticationRequestStatus status = CibaAuthenticationRequestStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "interval_seconds", nullable = false)
    private int intervalSeconds;

    @Column(name = "user_verification", nullable = false, length = 20)
    private String userVerification = "preferred";

    @Column(name = "mfa_required", nullable = false)
    private boolean mfaRequired;

    @Column(name = "step_up_required", nullable = false)
    private boolean stepUpRequired;

    @Column(name = "step_up_acr", length = 100)
    private String stepUpAcr;

    @Column(name = "last_polled_at")
    private Instant lastPolledAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "denied_at")
    private Instant deniedAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @SuppressWarnings("java:S107")
    public CibaAuthenticationRequestEntity(
            String authReqId,
            String registeredClientId,
            String principalName,
            String authorizedScopes,
            String bindingMessage,
            Instant createdAt,
            Instant expiresAt,
            int intervalSeconds) {
        this(
                authReqId,
                registeredClientId,
                principalName,
                authorizedScopes,
                bindingMessage,
                "poll",
                null,
                null,
                createdAt,
                expiresAt,
                intervalSeconds);
    }

    @SuppressWarnings("java:S107")
    public CibaAuthenticationRequestEntity(
            String authReqId,
            String registeredClientId,
            String principalName,
            String authorizedScopes,
            String bindingMessage,
            String deliveryMode,
            String notificationEndpoint,
            String clientNotificationToken,
            Instant createdAt,
            Instant expiresAt,
            int intervalSeconds) {
        this.authReqId = authReqId;
        this.registeredClientId = registeredClientId;
        this.principalName = principalName;
        this.authorizedScopes = authorizedScopes;
        this.bindingMessage = bindingMessage;
        this.deliveryMode = deliveryMode;
        this.notificationEndpoint = notificationEndpoint;
        this.clientNotificationToken = clientNotificationToken;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.intervalSeconds = intervalSeconds;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null) {
            return false;
        }
        Class<?> otherEffectiveClass =
                o instanceof HibernateProxy hibernateProxy
                        ? hibernateProxy.getHibernateLazyInitializer().getPersistentClass()
                        : o.getClass();
        Class<?> thisEffectiveClass =
                this instanceof HibernateProxy hibernateProxy
                        ? hibernateProxy.getHibernateLazyInitializer().getPersistentClass()
                        : this.getClass();
        if (thisEffectiveClass != otherEffectiveClass) {
            return false;
        }
        CibaAuthenticationRequestEntity that = (CibaAuthenticationRequestEntity) o;
        return getId() != null && Objects.equals(getId(), that.getId());
    }

    @Override
    public int hashCode() {
        return this instanceof HibernateProxy hibernateProxy
                ? hibernateProxy.getHibernateLazyInitializer().getPersistentClass().hashCode()
                : getClass().hashCode();
    }
}
