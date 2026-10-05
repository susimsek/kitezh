package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.ImpersonationTicketEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface ImpersonationTicketRepository
        extends JpaRepository<ImpersonationTicketEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ImpersonationTicketEntity> findByTicketHash(String ticketHash);
}
