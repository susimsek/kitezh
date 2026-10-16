package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A short-lived, single-use handoff between a desktop session and a social callback. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "desktop_social_link_transaction")
public class DesktopSocialLinkTransactionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "desktop_social_link_tx_seq")
    @SequenceGenerator(
            name = "desktop_social_link_tx_seq",
            sequenceName = "desktop_social_link_tx_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "authorization_token_hash", nullable = false, unique = true, length = 64)
    private String authorizationTokenHash;

    @Column(name = "code_challenge", nullable = false, length = 128)
    private String codeChallenge;

    @Column(name = "state", nullable = false, length = 256)
    private String state;

    @Column(name = "completion_code_hash", unique = true, length = 64)
    private String completionCodeHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;
}
