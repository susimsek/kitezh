package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AdminEventEntity;
import io.github.susimsek.kitezh.domain.AdminEventSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.AdminEventDTO;
import io.github.susimsek.kitezh.mapper.AdminEventMapper;
import io.github.susimsek.kitezh.repository.AdminEventRepository;
import io.github.susimsek.kitezh.repository.AdminEventSettingsRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

@SuppressWarnings("java:S5778")
class AdminAuditEventServiceTest {

    private final AdminEventRepository eventRepository = mock(AdminEventRepository.class);
    private final AdminEventSettingsRepository settingsRepository =
            mock(AdminEventSettingsRepository.class);
    private final AdminAuditEventService service =
            new AdminAuditEventService(
                    eventRepository, Mappers.getMapper(AdminEventMapper.class), null);

    @BeforeEach
    void resetRepositoryStubs() {
        reset(eventRepository, settingsRepository);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void recordsTheAuthenticatedActor() {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                                "admin", "n/a", java.util.List.of()));

        service.record("client.created", "client", "client-id");

        ArgumentCaptor<AdminEventEntity> event = ArgumentCaptor.forClass(AdminEventEntity.class);
        verify(eventRepository).save(event.capture());
        assertThat(event.getValue().getActor()).isEqualTo("admin");
        assertThat(event.getValue().getAction()).isEqualTo("client.created");
    }

    @Test
    void usesSystemForAnonymousEvents() {
        service.avatarDeleted(7L);

        ArgumentCaptor<AdminEventEntity> event = ArgumentCaptor.forClass(AdminEventEntity.class);
        verify(eventRepository).save(event.capture());
        assertThat(event.getValue().getActor()).isEqualTo("system");
        assertThat(event.getValue().getTargetId()).isEqualTo("7");
    }

    @Test
    void recordsOptionalAuditDetails() {
        service.record(
                "user.impersonation.started",
                "user",
                "7",
                "actor=admin;targetUsername=alice;result=success");

        ArgumentCaptor<AdminEventEntity> event = ArgumentCaptor.forClass(AdminEventEntity.class);
        verify(eventRepository).save(event.capture());
        assertThat(event.getValue().getDetails())
                .isEqualTo("actor=admin;targetUsername=alice;result=success");
    }

    @Test
    void recordsExplicitActorAndAvatarChanges() {
        service.recordAs("system-job", "user.avatar.updated", "user", "7", "updated");
        service.avatarUpdated(8L);

        ArgumentCaptor<AdminEventEntity> events = ArgumentCaptor.forClass(AdminEventEntity.class);
        verify(eventRepository, times(2)).save(events.capture());
        assertThat(events.getAllValues())
                .extracting(AdminEventEntity::getActor)
                .contains("system-job", "system");
        assertThat(events.getAllValues())
                .extracting(AdminEventEntity::getAction)
                .contains("user.avatar.updated");
    }

    @Test
    void recordsWithSettingsAndDeletesExpiredEvents() {
        AdminEventSettingsEntity settings = settings(true, true, true, 30);
        when(settingsRepository.findById(1L)).thenReturn(java.util.Optional.of(settings));
        AdminAuditEventService configuredService =
                new AdminAuditEventService(
                        eventRepository,
                        Mappers.getMapper(AdminEventMapper.class),
                        settingsRepository);

        configuredService.record("user.updated", "user", "7", "details");

        verify(eventRepository).deleteByOccurredAtBefore(any(Instant.class));
        verify(eventRepository).save(any(AdminEventEntity.class));
    }

    @Test
    void omitsDetailsWhenDetailsAreDisabled() {
        AdminEventSettingsEntity settings = settings(true, true, false, 0);
        when(settingsRepository.findById(1L)).thenReturn(java.util.Optional.of(settings));
        AdminAuditEventService configuredService =
                new AdminAuditEventService(
                        eventRepository,
                        Mappers.getMapper(AdminEventMapper.class),
                        settingsRepository);

        configuredService.record("user.updated", "user", "7", "details");

        ArgumentCaptor<AdminEventEntity> event = ArgumentCaptor.forClass(AdminEventEntity.class);
        verify(eventRepository).save(event.capture());
        assertThat(event.getValue().getDetails()).isNull();
    }

    @Test
    void skipsEventsWhenEventCollectionIsDisabled() {
        AdminEventSettingsEntity settings = settings(false, true, true, 30);
        when(settingsRepository.findById(1L)).thenReturn(java.util.Optional.of(settings));

        new AdminAuditEventService(
                        eventRepository,
                        Mappers.getMapper(AdminEventMapper.class),
                        settingsRepository)
                .record("user.updated", "user", "7");

        verifyNoInteractions(eventRepository);
    }

    @Test
    void skipsEventsWhenAdministrativeEventsAreDisabled() {
        AdminEventSettingsEntity settings = settings(true, false, true, 30);
        when(settingsRepository.findById(1L)).thenReturn(java.util.Optional.of(settings));

        new AdminAuditEventService(
                        eventRepository,
                        Mappers.getMapper(AdminEventMapper.class),
                        settingsRepository)
                .record("user.updated", "user", "7");

        verifyNoInteractions(eventRepository);
    }

    @Test
    void requiresInitializedSettingsWhenConfigured() {
        when(settingsRepository.findById(1L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(
                        () ->
                                new AdminAuditEventService(
                                                eventRepository,
                                                Mappers.getMapper(AdminEventMapper.class),
                                                settingsRepository)
                                        .record("user.updated", "user", "7"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Event settings are not initialized");
    }

    @Test
    void deletesAllEventsAndRecordsClearEvent() {
        service.deleteAll();

        verify(eventRepository).deleteAllInBatch();
        verify(eventRepository).save(any(AdminEventEntity.class));
    }

    @Test
    void delegatesFilteredAndTargetSpecificQueries() {
        var pageable = PageRequest.of(0, 20);
        when(eventRepository.findAll(any(Specification.class), eq(pageable)))
                .thenReturn(Page.empty(pageable));
        when(eventRepository.findByTargetTypeAndTargetId("user", "7", pageable))
                .thenReturn(Page.empty(pageable));
        when(eventRepository.findByTargetTypeAndTargetId("client", "client-id", pageable))
                .thenReturn(Page.empty(pageable));

        assertThat(service.events("  USER ", "user.updated", "user", "7", null, null, pageable))
                .isEmpty();
        assertThat(service.userEvents(7L, pageable)).isEmpty();
        assertThat(service.clientEvents("client-id", pageable)).isEmpty();
        verify(eventRepository).findAll(any(Specification.class), eq(pageable));
        verify(eventRepository).findByTargetTypeAndTargetId("user", "7", pageable);
        verify(eventRepository).findByTargetTypeAndTargetId("client", "client-id", pageable);
    }

    @Test
    void mapsTargetSpecificEventPages() {
        AdminEventMapper mapper = mock(AdminEventMapper.class);
        AdminEventEntity entity = new AdminEventEntity();
        AdminEventDTO dto = mock(AdminEventDTO.class);
        var pageable = PageRequest.of(0, 20);
        when(eventRepository.findByTargetTypeAndTargetId("user", "7", pageable))
                .thenReturn(
                        new org.springframework.data.domain.PageImpl<>(
                                List.of(entity), pageable, 1));
        when(mapper.toDTO(entity)).thenReturn(dto);
        AdminAuditEventService mappedService =
                new AdminAuditEventService(eventRepository, mapper, null);

        assertThat(mappedService.userEvents(7L, pageable).getContent()).containsExactly(dto);
    }

    @Test
    void buildsSearchAndAllOptionalEventFilters() {
        var pageable = PageRequest.of(0, 20);
        when(eventRepository.findAll(any(Specification.class), eq(pageable)))
                .thenReturn(Page.empty(pageable));

        service.events(
                "  USER ",
                "user.updated",
                "user",
                "7",
                Instant.parse("2024-01-01T00:00:00Z"),
                Instant.parse("2024-01-02T00:00:00Z"),
                pageable);
        service.events(null, " ", "", "", null, null, pageable);

        ArgumentCaptor<Specification<AdminEventEntity>> specifications =
                ArgumentCaptor.forClass(Specification.class);
        verify(eventRepository, times(2)).findAll(specifications.capture(), eq(pageable));
        Root<AdminEventEntity> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder criteriaBuilder = mock(CriteriaBuilder.class);
        specifications
                .getAllValues()
                .forEach(specification -> specification.toPredicate(root, query, criteriaBuilder));
    }

    private static AdminEventSettingsEntity settings(
            boolean eventsEnabled,
            boolean adminEventsEnabled,
            boolean detailsEnabled,
            int expirationDays) {
        AdminEventSettingsEntity settings = new AdminEventSettingsEntity();
        settings.setId(1L);
        settings.setEventsEnabled(eventsEnabled);
        settings.setAdminEventsEnabled(adminEventsEnabled);
        settings.setAdminEventsDetailsEnabled(detailsEnabled);
        settings.setEventsExpirationDays(expirationDays);
        return settings;
    }
}
