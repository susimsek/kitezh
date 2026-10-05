package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface OAuth2KeyRepository extends JpaRepository<OAuth2KeyEntity, String> {

    String OAUTH2_KEYS_CACHE = "oauth2Keys";

    @Cacheable(cacheNames = OAUTH2_KEYS_CACHE)
    @Query("select k from OAuth2KeyEntity k order by k.createdAt desc")
    List<OAuth2KeyEntity> findAllKeys();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select k from OAuth2KeyEntity k")
    List<OAuth2KeyEntity> findAllForRotation();

    Page<OAuth2KeyEntity> findByKidContainingIgnoreCase(String kid, Pageable pageable);

    Page<OAuth2KeyEntity> findByKidContainingIgnoreCaseAndActive(
            String kid, boolean active, Pageable pageable);
}
