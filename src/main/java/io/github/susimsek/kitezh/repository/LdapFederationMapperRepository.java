package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.LdapFederationMapperEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LdapFederationMapperRepository
        extends JpaRepository<LdapFederationMapperEntity, Long> {

    List<LdapFederationMapperEntity> findAllByProviderIdOrderByNameAsc(String providerId);

    List<LdapFederationMapperEntity> findAllByProviderIdAndEnabledTrueOrderByNameAsc(
            String providerId);

    Optional<LdapFederationMapperEntity> findByIdAndProviderId(Long id, String providerId);

    boolean existsByProviderIdAndNameIgnoreCase(String providerId, String name);

    boolean existsByProviderIdAndNameIgnoreCaseAndIdNot(String providerId, String name, Long id);

    void deleteAllByProviderId(String providerId);
}
