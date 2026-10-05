package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.RecoveryCodeEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecoveryCodeRepository extends JpaRepository<RecoveryCodeEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select c from RecoveryCodeEntity c where c.user.id = :userId and c.usedAt is null"
                    + " order by c.codeIndex")
    Optional<RecoveryCodeEntity> findNextUnusedForUpdate(@Param("userId") Long userId);

    List<RecoveryCodeEntity> findAllByUserIdOrderByCodeIndexAsc(Long userId);

    long countByUserIdAndUsedAtIsNull(Long userId);

    @Modifying
    void deleteByUserId(Long userId);
}
