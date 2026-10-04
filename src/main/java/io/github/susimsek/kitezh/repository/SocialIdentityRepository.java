package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialIdentityRepository extends JpaRepository<SocialIdentityEntity, Long> {

    Optional<SocialIdentityEntity> findByProviderAndSubject(String provider, String subject);

    List<SocialIdentityEntity> findAllByUserUsername(String username);

    List<SocialIdentityEntity> findAllByProvider(String provider);

    List<SocialIdentityEntity> findAllByUserUsernameAndProvider(String username, String provider);
}
