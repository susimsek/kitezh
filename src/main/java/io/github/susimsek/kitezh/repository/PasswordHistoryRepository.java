package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.PasswordHistoryEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordHistoryRepository extends JpaRepository<PasswordHistoryEntity, Long> {

    List<PasswordHistoryEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    long deleteByUserId(Long userId);
}
