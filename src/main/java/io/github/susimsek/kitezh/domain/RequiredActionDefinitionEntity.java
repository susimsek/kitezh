package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/** Configurable required action policy. Global actions are evaluated by version. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Table(name = "required_action_definition")
public class RequiredActionDefinitionEntity extends AuditableEntity {

    @Id
    @Column(name = "action_key", length = 100)
    private String actionKey;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "global_policy", nullable = false)
    private boolean globalPolicy;

    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "priority", nullable = false)
    private int priority;

    @Column(name = "configuration", length = 4000)
    private String configuration;
}
