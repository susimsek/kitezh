package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;
import org.jspecify.annotations.Nullable;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;

@Getter
@Setter
@MappedSuperclass
public abstract class AuditableEntity extends DateAuditingEntity {

    @CreatedBy
    @Column(name = "created_by", nullable = false, updatable = false, length = 100)
    protected String createdBy;

    @LastModifiedBy
    @Column(name = "last_modified_by", length = 100)
    protected @Nullable String lastModifiedBy;

    protected AuditableEntity() {}
}
