package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CibaAuthenticationRequestRepository
        extends JpaRepository<CibaAuthenticationRequestEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select request from CibaAuthenticationRequestEntity request where request.authReqId ="
                    + " :authReqId")
    Optional<CibaAuthenticationRequestEntity> findByAuthReqIdForUpdate(
            @Param("authReqId") String authReqId);

    boolean existsByUserCode(String userCode);

    Page<CibaAuthenticationRequestEntity> findByPrincipalNameAndStatusAndExpiresAtAfter(
            String principalName,
            CibaAuthenticationRequestStatus status,
            Instant now,
            Pageable pageable);
}
