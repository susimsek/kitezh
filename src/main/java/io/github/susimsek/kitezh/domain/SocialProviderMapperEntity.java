package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
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
@Table(name = "social_provider_mappers")
public class SocialProviderMapperEntity extends AuditableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(name = "provider_alias", nullable = false, length = 50)
    private String providerAlias;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "source_claim", nullable = false, length = 200)
    private String sourceClaim;

    @Column(name = "target", nullable = false, length = 200)
    private String target;

    @Column(name = "mapper_type", nullable = false, length = 40)
    private String mapperType = "user-attribute";

    @Column(name = "sync_mode", nullable = false, length = 20)
    private String syncMode = "inherit";

    @Column(name = "add_to_id_token", nullable = false)
    private boolean addToIdToken;

    @Column(name = "add_to_access_token", nullable = false)
    private boolean addToAccessToken;
}
