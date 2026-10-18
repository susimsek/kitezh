package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.MobileLoginTransactionEntity;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MobileLoginTransactionRepository
        extends JpaRepository<MobileLoginTransactionEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select transaction from MobileLoginTransactionEntity transaction where transaction.id"
                    + " = :id")
    Optional<MobileLoginTransactionEntity> findByIdForUpdate(@Param("id") String id);

    @Modifying
    @Query(
            "delete from MobileLoginTransactionEntity transaction where transaction.expiresAt <"
                    + " :now")
    int deleteExpired(@Param("now") Instant now);
}
