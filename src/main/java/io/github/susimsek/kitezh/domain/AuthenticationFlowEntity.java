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

/** A Keycloak-style authentication flow in the application's single issuer. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authentication_flow")
public class AuthenticationFlowEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "authentication_flow_seq")
    @SequenceGenerator(
            name = "authentication_flow_seq",
            sequenceName = "authentication_flow_seq",
            allocationSize = 1)
    private Long id;

    @Column(name = "alias", nullable = false, unique = true, length = 100)
    private String alias;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "flow_type", nullable = false, length = 20)
    private AuthenticationFlowType flowType;

    @Column(name = "built_in", nullable = false)
    private boolean builtIn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_flow_id")
    private AuthenticationFlowEntity parentFlow;

    @Enumerated(EnumType.STRING)
    @Column(name = "requirement", length = 20)
    private AuthenticationFlowRequirement requirement;

    @Column(name = "priority", nullable = false)
    private int priority;

    public boolean isTopLevel() {
        return parentFlow == null;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof AuthenticationFlowEntity other)) {
            return false;
        }
        return id != null && Objects.equals(id, other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
