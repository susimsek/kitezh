package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationIdentityProviderEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationIdentityProviderRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminOrganizationIdentityProviderServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationIdentityProviderRepository bindingRepository;
    @Mock private SocialProviderRepository providerRepository;
    @Mock private AdminAuditEventService adminAuditEventService;

    @Test
    void bindsListsUpdatesAndRemovesProvider() {
        OrganizationEntity organization = organization(8L);
        SocialProviderEntity provider = provider("google", "google");
        OrganizationIdentityProviderEntity binding = binding(4L, organization, "google");
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(providerRepository.findByAliasIgnoreCase("google")).thenReturn(Optional.of(provider));
        when(bindingRepository.existsByOrganizationIdAndProviderAliasIgnoreCase(8L, "google"))
                .thenReturn(false);
        when(bindingRepository.save(any(OrganizationIdentityProviderEntity.class)))
                .thenAnswer(
                        invocation -> {
                            OrganizationIdentityProviderEntity saved = invocation.getArgument(0);
                            saved.setId(4L);
                            return saved;
                        });
        when(bindingRepository.findByOrganizationId(8L, Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(java.util.List.of(binding)));
        when(bindingRepository.findById(4L)).thenReturn(Optional.of(binding));

        var added =
                service().add(8L, new AdminOrganizationIdentityProviderRequestDTO("GOOGLE", true));
        var listed = service().findAll(8L, Pageable.ofSize(20));
        var updated =
                service()
                        .update(
                                8L,
                                4L,
                                new AdminOrganizationIdentityProviderRequestDTO("google", false));
        service().remove(8L, 4L);

        assertThat(added.providerAlias()).isEqualTo("google");
        assertThat(listed.getContent()).hasSize(1);
        assertThat(updated.enabled()).isFalse();
        verify(bindingRepository).delete(binding);
    }

    @Test
    void rejectsUnknownAndDuplicateProvider() {
        OrganizationEntity organization = organization(8L);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(providerRepository.findByAliasIgnoreCase("unknown")).thenReturn(Optional.empty());
        when(providerRepository.findByRegistrationId("unknown")).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service()
                                        .add(
                                                8L,
                                                new AdminOrganizationIdentityProviderRequestDTO(
                                                        "unknown", true)))
                .isInstanceOf(ApiException.class);

        SocialProviderEntity provider = provider("google", "google");
        when(providerRepository.findByAliasIgnoreCase("google")).thenReturn(Optional.of(provider));
        when(bindingRepository.existsByOrganizationIdAndProviderAliasIgnoreCase(8L, "google"))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service()
                                        .add(
                                                8L,
                                                new AdminOrganizationIdentityProviderRequestDTO(
                                                        "google", true)))
                .isInstanceOf(ApiException.class);
    }

    private AdminOrganizationIdentityProviderService service() {
        return new AdminOrganizationIdentityProviderService(
                organizationRepository,
                bindingRepository,
                providerRepository,
                adminAuditEventService);
    }

    private static OrganizationEntity organization(Long id) {
        OrganizationEntity entity = new OrganizationEntity();
        entity.setId(id);
        entity.setAlias("acme");
        entity.setName("Acme");
        return entity;
    }

    private static OrganizationIdentityProviderEntity binding(
            Long id, OrganizationEntity organization, String alias) {
        OrganizationIdentityProviderEntity entity = new OrganizationIdentityProviderEntity();
        entity.setId(id);
        entity.setOrganization(organization);
        entity.setProviderAlias(alias);
        entity.setEnabled(true);
        return entity;
    }

    private static SocialProviderEntity provider(String alias, String registrationId) {
        SocialProviderEntity entity = new SocialProviderEntity();
        entity.setAlias(alias);
        entity.setRegistrationId(registrationId);
        return entity;
    }
}
