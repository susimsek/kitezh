package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.LdapFederationIdentityEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LdapFederationIdentityRepository
        extends JpaRepository<LdapFederationIdentityEntity, Long> {

    Optional<LdapFederationIdentityEntity> findByProviderIdAndExternalId(
            String providerId, String externalId);

    Optional<LdapFederationIdentityEntity> findByUserUsername(String username);

    List<LdapFederationIdentityEntity> findAllByProviderId(String providerId);

    boolean existsByProviderId(String providerId);
}
