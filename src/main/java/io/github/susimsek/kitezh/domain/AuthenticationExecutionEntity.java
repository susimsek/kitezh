package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A concrete authenticator execution belonging to one flow. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authentication_execution")
public class AuthenticationExecutionEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "authentication_execution_seq")
    @SequenceGenerator(
            name = "authentication_execution_seq",
            sequenceName = "authentication_execution_seq",
            allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "flow_id", nullable = false)
    private AuthenticationFlowEntity flow;

    @Column(name = "provider_id", nullable = false, length = 100)
    private String providerId;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "requirement", nullable = false, length = 20)
    private AuthenticationFlowRequirement requirement;

    @Column(name = "priority", nullable = false)
    private int priority;

    @Column(name = "authenticator_reference", length = 100)
    private String authenticatorReference;

    @Column(name = "configuration", length = 4000)
    private String configuration;

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof AuthenticationExecutionEntity other)) {
            return false;
        }
        return id != null && Objects.equals(id, other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
