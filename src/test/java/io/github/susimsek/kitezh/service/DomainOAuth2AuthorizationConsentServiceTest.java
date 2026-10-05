package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.mapper.AuthorizationConsentMapper;
import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.repository.AuthorizationConsentRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsent;

@ExtendWith(MockitoExtension.class)
class DomainOAuth2AuthorizationConsentServiceTest {

    @Mock private AuthorizationConsentRepository repository;
    @Mock private AuthorizationConsentMapper mapper;
    @Mock private AuthorizationServerMapperSupport mapperSupport;

    @Test
    void savesAndRemovesConsent() {
        OAuth2AuthorizationConsent consent =
                OAuth2AuthorizationConsent.withId("client", "admin")
                        .authority(new SimpleGrantedAuthority("ROLE_ADMIN"))
                        .build();
        AuthorizationConsentEntity entity = new AuthorizationConsentEntity();
        when(mapper.toEntity(consent, mapperSupport)).thenReturn(entity);

        DomainOAuth2AuthorizationConsentService service =
                new DomainOAuth2AuthorizationConsentService(repository, mapper, mapperSupport);
        service.save(consent);
        service.remove(consent);

        verify(repository).save(entity);
        verify(repository).deleteByIdRegisteredClientIdAndIdPrincipalName("client", "admin");
    }

    @Test
    void findsConsentOrReturnsNull() {
        OAuth2AuthorizationConsent consent =
                OAuth2AuthorizationConsent.withId("client", "admin")
                        .authority(new SimpleGrantedAuthority("ROLE_ADMIN"))
                        .build();
        AuthorizationConsentEntity entity = new AuthorizationConsentEntity();
        when(repository.findByIdRegisteredClientIdAndIdPrincipalName("client", "admin"))
                .thenReturn(Optional.of(entity));
        when(mapper.toObject(entity, mapperSupport)).thenReturn(consent);

        DomainOAuth2AuthorizationConsentService service =
                new DomainOAuth2AuthorizationConsentService(repository, mapper, mapperSupport);

        assertThat(service.findById("client", "admin")).isSameAs(consent);
        assertThat(service.findById("client", "missing")).isNull();
    }
}
