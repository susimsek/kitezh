package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperType;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapMapperRequestDTO;
import io.github.susimsek.springauthserversamples.repository.LdapFederationMapperRepository;
import io.github.susimsek.springauthserversamples.repository.LdapFederationProviderRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LdapFederationMapperAdminServiceTest {

    private final LdapFederationMapperRepository mapperRepository =
            mock(LdapFederationMapperRepository.class);
    private final LdapFederationProviderRepository providerRepository =
            mock(LdapFederationProviderRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final LdapFederationMapperAdminService service =
            new LdapFederationMapperAdminService(
                    mapperRepository, providerRepository, auditEventService);

    @Test
    void listsProviderMappers() {
        LdapFederationProviderEntity provider = provider();
        LdapFederationMapperEntity mapper = mapper(4L, "Department");
        when(providerRepository.findById("provider-id")).thenReturn(Optional.of(provider));
        when(mapperRepository.findAllByProviderIdOrderByNameAsc("provider-id"))
                .thenReturn(List.of(mapper));

        assertThat(service.list("provider-id"))
                .singleElement()
                .satisfies(value -> assertThat(value.id()).isEqualTo(4L));
    }

    @Test
    void createsAndUpdatesMapperAndRecordsAuditEvents() {
        LdapFederationProviderEntity provider = provider();
        when(providerRepository.findById("provider-id")).thenReturn(Optional.of(provider));
        when(mapperRepository.existsByProviderIdAndNameIgnoreCase("provider-id", "Department"))
                .thenReturn(false);
        when(mapperRepository.save(any(LdapFederationMapperEntity.class)))
                .thenAnswer(
                        invocation -> {
                            LdapFederationMapperEntity value = invocation.getArgument(0);
                            if (value.getId() == null) {
                                value.setId(4L);
                            }
                            return value;
                        });

        var created = service.save("provider-id", request(null));
        assertThat(created.id()).isEqualTo(4L);
        verify(auditEventService).record("ldap.mapper.created", "ldap-mapper", "4");

        LdapFederationMapperEntity existing = mapper(4L, "Department");
        when(mapperRepository.existsByProviderIdAndNameIgnoreCaseAndIdNot(
                        "provider-id", "Department", 4L))
                .thenReturn(false);
        when(mapperRepository.findByIdAndProviderId(4L, "provider-id"))
                .thenReturn(Optional.of(existing));
        service.save("provider-id", request(4L));
        verify(auditEventService).record("ldap.mapper.updated", "ldap-mapper", "4");
    }

    @Test
    void rejectsDuplicatesAndDeletesMapper() {
        when(providerRepository.findById("provider-id")).thenReturn(Optional.of(provider()));
        when(mapperRepository.existsByProviderIdAndNameIgnoreCase("provider-id", "Department"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.save("provider-id", request(null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP mapper names must be unique per provider");

        LdapFederationMapperEntity mapper = mapper(4L, "Department");
        when(mapperRepository.findByIdAndProviderId(4L, "provider-id"))
                .thenReturn(Optional.of(mapper));
        service.delete("provider-id", 4L);
        verify(mapperRepository).delete(mapper);
        verify(auditEventService).record("ldap.mapper.deleted", "ldap-mapper", "4");
    }

    private static LdapFederationProviderEntity provider() {
        LdapFederationProviderEntity provider = new LdapFederationProviderEntity();
        provider.setId("provider-id");
        return provider;
    }

    private static LdapFederationMapperEntity mapper(Long id, String name) {
        LdapFederationMapperEntity mapper = new LdapFederationMapperEntity();
        mapper.setId(id);
        mapper.setName(name);
        mapper.setType(LdapFederationMapperType.USER_ATTRIBUTE);
        return mapper;
    }

    private static AdminLdapMapperRequestDTO request(Long id) {
        return new AdminLdapMapperRequestDTO(
                id,
                "Department",
                LdapFederationMapperType.USER_ATTRIBUTE,
                true,
                "department",
                "department",
                null,
                null,
                null,
                "groupOfNames",
                "cn",
                "member");
    }
}
