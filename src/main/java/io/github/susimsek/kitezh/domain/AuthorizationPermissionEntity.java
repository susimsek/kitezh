package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Connects a resource and optional scope to reusable authorization policies. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authz_permission")
public class AuthorizationPermissionEntity extends AuditableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "resource_id", nullable = false, length = 36)
    private String resourceId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "scope_name", length = 100)
    private String scopeName;

    @Column(name = "decision_strategy", nullable = false, length = 20)
    private String decisionStrategy;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "authz_permission_policies",
            joinColumns = @JoinColumn(name = "permission_id"),
            inverseJoinColumns = @JoinColumn(name = "policy_id"))
    private Set<AuthorizationPolicyEntity> policies = new LinkedHashSet<>();
}
