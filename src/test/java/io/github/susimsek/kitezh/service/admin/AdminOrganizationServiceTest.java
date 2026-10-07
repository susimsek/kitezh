package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.mapper.AdminOrganizationMapper;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private AdminAuditEventService adminAuditEventService;

    @Test
    void createsOrganizationWithNormalizedAliasAndAttributes() {
        when(organizationRepository.existsByAliasIgnoreCase("acme")).thenReturn(false);
        when(organizationRepository.save(any(OrganizationEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationEntity entity = invocation.getArgument(0);
                            entity.setId(7L);
                            return entity;
                        });

        var result =
                service()
                        .create(
                                new AdminOrganizationRequestDTO(
                                        " ACME ",
                                        "Acme",
                                        "https://acme.example.com",
                                        "Customer",
                                        true,
                                        Map.of("tier", List.of("enterprise"))));

        assertThat(result.id()).isEqualTo(7L);
        assertThat(result.alias()).isEqualTo("acme");
        assertThat(result.attributes()).containsEntry("tier", List.of("enterprise"));
        verify(adminAuditEventService).record("organization.created", "organization", "7");
    }

    @Test
    void rejectsDuplicateAliasAndInvalidRedirectUrl() {
        when(organizationRepository.existsByAliasIgnoreCase("acme")).thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new AdminOrganizationRequestDTO(
                                                        "acme", "Acme", null, null, true,
                                                        Map.of())))
                .isInstanceOf(ApiException.class);

        when(organizationRepository.existsByAliasIgnoreCase("bad-redirect")).thenReturn(false);
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new AdminOrganizationRequestDTO(
                                                        "bad-redirect",
                                                        "Bad",
                                                        "/relative",
                                                        null,
                                                        true,
                                                        Map.of())))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsAliasChangesAndLoadsPagedOrganizations() {
        OrganizationEntity entity = organization(7L, "acme", "Acme");
        when(organizationRepository.findById(7L)).thenReturn(Optional.of(entity));

        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                7L,
                                                new AdminOrganizationRequestDTO(
                                                        "other", "Acme", null, null, true,
                                                        Map.of())))
                .isInstanceOf(ApiException.class);

        when(organizationRepository.findByAliasContainingIgnoreCaseOrNameContainingIgnoreCase(
                        "acme", "acme", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(entity), Pageable.ofSize(20), 1));
        assertThat(service().findAll(" acme ", Pageable.ofSize(20)).getContent())
                .extracting("alias")
                .containsExactly("acme");
    }

    @Test
    void returnsNotFoundForUnknownOrganization() {
        when(organizationRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().findById(99L)).isInstanceOf(ApiException.class);
    }

    @Test
    void findsAndUpdatesOrganizationWithOptionalValues() {
        OrganizationEntity entity = organization(7L, "acme", "Acme");
        Pageable pageable = Pageable.ofSize(20);
        when(organizationRepository.findById(7L)).thenReturn(Optional.of(entity));
        when(organizationRepository.findByAliasContainingIgnoreCaseOrNameContainingIgnoreCase(
                        "", "", pageable))
                .thenReturn(new PageImpl<>(List.of(entity), pageable, 1));

        assertThat(service().findById(7L).alias()).isEqualTo("acme");
        assertThat(service().findAll(null, pageable).getContent()).hasSize(1);

        var updated =
                service()
                        .update(
                                7L,
                                new AdminOrganizationRequestDTO(
                                        " ACME ", "Updated", "", null, false, Map.of()));
        assertThat(updated.name()).isEqualTo("Updated");
        assertThat(updated.enabled()).isFalse();
        verify(adminAuditEventService).record("organization.updated", "organization", "7");
    }

    @Test
    void rejectsMalformedAliases() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .create(
                                                new AdminOrganizationRequestDTO(
                                                        "bad alias",
                                                        "Bad",
                                                        null,
                                                        null,
                                                        true,
                                                        Map.of())))
                .isInstanceOf(ApiException.class);
    }

    private AdminOrganizationService service() {
        return new AdminOrganizationService(
                organizationRepository,
                Mappers.getMapper(AdminOrganizationMapper.class),
                adminAuditEventService);
    }

    private static OrganizationEntity organization(Long id, String alias, String name) {
        OrganizationEntity entity = new OrganizationEntity();
        entity.setId(id);
        entity.setAlias(alias);
        entity.setName(name);
        return entity;
    }
}
