package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A reusable subject rule evaluated independently from administrator RBAC. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authz_policy")
public class AuthorizationPolicyEntity extends AuditableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "resource_server_client_id", nullable = false, length = 100)
    private String resourceServerClientId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "policy_type", nullable = false, length = 20)
    private String type;

    @Column(name = "subject_value", length = 200)
    private String subjectValue;

    @Column(name = "effect", nullable = false, length = 10)
    private String effect;

    @ManyToMany(mappedBy = "policies", fetch = FetchType.LAZY)
    private Set<AuthorizationPermissionEntity> permissions = new LinkedHashSet<>();
}
