package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationDomainEntity;
import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationDomainRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationDomainServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationDomainRepository domainRepository;
    @Mock private AdminAuditEventService adminAuditEventService;

    @Test
    void listsAndAddsNormalizedDomain() {
        OrganizationEntity organization = organization(8L);
        OrganizationDomainEntity existing = domain(3L, organization, "acme.com");
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(domainRepository.findByOrganizationId(8L, Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(existing)));
        when(domainRepository.existsByDomainIgnoreCase("example.com")).thenReturn(false);
        when(domainRepository.save(any(OrganizationDomainEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationDomainEntity saved = invocation.getArgument(0);
                            saved.setId(4L);
                            return saved;
                        });

        assertThat(service().findAll(8L, Pageable.ofSize(20)).getContent().getFirst().domain())
                .isEqualTo("acme.com");
        var added = service().add(8L, new AdminOrganizationDomainRequestDTO(" Example.COM "));

        assertThat(added.id()).isEqualTo(4L);
        assertThat(added.domain()).isEqualTo("example.com");
        verify(adminAuditEventService)
                .record("organization.domain.added", "organization", "8", "domain=example.com");
    }

    @Test
    void rejectsDuplicateAndInvalidDomainAndRemovesOwnedDomain() {
        OrganizationEntity organization = organization(8L);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(domainRepository.existsByDomainIgnoreCase("acme.com")).thenReturn(true);
        assertThatThrownBy(
                        () -> service().add(8L, new AdminOrganizationDomainRequestDTO("acme.com")))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () -> service().add(8L, new AdminOrganizationDomainRequestDTO("invalid")))
                .isInstanceOf(ApiException.class);

        OrganizationDomainEntity domain = domain(3L, organization, "acme.com");
        when(domainRepository.findById(3L)).thenReturn(Optional.of(domain));
        service().remove(8L, 3L);
        verify(domainRepository).delete(domain);
        verify(adminAuditEventService)
                .record("organization.domain.removed", "organization", "8", "domain=acme.com");

        when(domainRepository.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().remove(8L, 9L)).isInstanceOf(ApiException.class);
    }

    private AdminOrganizationDomainService service() {
        return new AdminOrganizationDomainService(
                organizationRepository, domainRepository, adminAuditEventService);
    }

    private static OrganizationEntity organization(Long id) {
        OrganizationEntity entity = new OrganizationEntity();
        entity.setId(id);
        entity.setAlias("acme");
        entity.setName("Acme");
        return entity;
    }

    private static OrganizationDomainEntity domain(
            Long id, OrganizationEntity organization, String value) {
        OrganizationDomainEntity entity = new OrganizationDomainEntity();
        entity.setId(id);
        entity.setOrganization(organization);
        entity.setDomain(value);
        return entity;
    }
}
