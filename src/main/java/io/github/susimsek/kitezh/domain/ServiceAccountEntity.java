package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "oauth2_service_account")
public class ServiceAccountEntity extends AuditableEntity {

    @Id
    @Column(name = "client_id", nullable = false, length = 100)
    private String clientId;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private UserEntity user;

    public ServiceAccountEntity(String clientId, UserEntity user) {
        this.clientId = clientId;
        this.user = user;
    }
}
