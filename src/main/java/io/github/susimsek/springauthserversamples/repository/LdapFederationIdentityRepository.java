package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.LdapFederationIdentityEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LdapFederationIdentityRepository
        extends JpaRepository<LdapFederationIdentityEntity, Long> {

    Optional<LdapFederationIdentityEntity> findByProviderIdAndExternalId(
            String providerId, String externalId);

    Optional<LdapFederationIdentityEntity> findByUserUsername(String username);

    boolean existsByProviderId(String providerId);
}
