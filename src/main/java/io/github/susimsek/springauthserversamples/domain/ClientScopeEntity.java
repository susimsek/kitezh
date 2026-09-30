package io.github.susimsek.springauthserversamples.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Table(name = "oauth2_client_scope")
public class ClientScopeEntity extends AuditableEntity {

    public static final String CACHE_NAME =
            "io.github.susimsek.springauthserversamples.domain.ClientScopeEntity";

    @Id
    @Column(name = "id", nullable = false, length = 100)
    private String id;

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "display_name", length = 200)
    private String displayName;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "built_in", nullable = false)
    private boolean builtIn;

    @Column(name = "display_on_consent_screen", nullable = false)
    private boolean displayOnConsentScreen;

    @Column(name = "consent_screen_text", length = 200)
    private String consentScreenText;

    @Column(name = "include_in_token_scope", nullable = false)
    private boolean includeInTokenScope = true;

    @Column(name = "group_mapper_enabled", nullable = false)
    private boolean groupMapperEnabled;

    @Column(name = "group_claim_name", nullable = false, length = 100)
    private String groupClaimName = "groups";

    @Column(name = "group_mapper_full_path", nullable = false)
    private boolean groupMapperFullPath = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "oauth2_client_scope_authorities",
            joinColumns = @JoinColumn(name = "client_scope_id"),
            inverseJoinColumns = @JoinColumn(name = "authority_id"))
    private Set<AuthorityEntity> applicationRoles = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "oauth2_client_scope_client_roles",
            joinColumns = @JoinColumn(name = "client_scope_id"),
            inverseJoinColumns = @JoinColumn(name = "client_role_id"))
    private Set<ClientRoleEntity> clientRoles = new HashSet<>();
}
