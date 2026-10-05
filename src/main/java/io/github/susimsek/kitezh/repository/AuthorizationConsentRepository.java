package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.domain.AuthorizationConsentId;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuthorizationConsentRepository
        extends JpaRepository<AuthorizationConsentEntity, AuthorizationConsentId>,
                JpaSpecificationExecutor<AuthorizationConsentEntity> {

    Optional<AuthorizationConsentEntity> findByIdRegisteredClientIdAndIdPrincipalName(
            String registeredClientId, String principalName);

    void deleteByIdRegisteredClientIdAndIdPrincipalName(
            String registeredClientId, String principalName);

    long deleteByIdRegisteredClientId(String registeredClientId);

    long deleteByIdPrincipalName(String principalName);

    Page<AuthorizationConsentEntity> findByIdRegisteredClientId(
            String registeredClientId, Pageable pageable);

    Page<AuthorizationConsentEntity> findByIdPrincipalName(String principalName, Pageable pageable);
}
