package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthorizationPermissionTicketEntity;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface AuthorizationPermissionTicketRepository
        extends JpaRepository<AuthorizationPermissionTicketEntity, String> {

    @Modifying
    long deleteByExpiresAtBefore(Instant time);
}
