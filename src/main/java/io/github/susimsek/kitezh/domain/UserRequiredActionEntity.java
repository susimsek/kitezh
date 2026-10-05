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
@Table(name = "user_required_action")
public class UserRequiredActionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "user_required_action_seq")
    @SequenceGenerator(
            name = "user_required_action_seq",
            sequenceName = "user_required_action_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "action_key", nullable = false, length = 100)
    private String actionKey;

    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;
}
