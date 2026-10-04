package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.LdapFederationProviderEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LdapFederationProviderRepository
        extends JpaRepository<LdapFederationProviderEntity, String> {

    List<LdapFederationProviderEntity> findAllByOrderByPriorityAscNameAsc();

    List<LdapFederationProviderEntity> findAllByEnabledTrueOrderByPriorityAscNameAsc();

    Optional<LdapFederationProviderEntity> findByNameIgnoreCase(String name);
}
