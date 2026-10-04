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

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "impersonation_ticket")
public class ImpersonationTicketEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "impersonation_ticket_seq")
    @SequenceGenerator(
            name = "impersonation_ticket_seq",
            sequenceName = "impersonation_ticket_seq",
            allocationSize = 1)
    private Long id;

    @Column(name = "ticket_hash", nullable = false, unique = true, length = 64)
    private String ticketHash;

    @Column(name = "actor_username", nullable = false, length = 100)
    private String actorUsername;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_user_id", nullable = false)
    private UserEntity targetUser;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;
}
