package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationPermissionEntity;
import io.github.susimsek.kitezh.domain.OrganizationPermissionLevel;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationPermissionRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationPermissionRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
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
class OrganizationPermissionServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationPermissionRepository permissionRepository;
    @Mock private UserRepository userRepository;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void listsAndUpsertsOrganizationPermission() {
        OrganizationEntity organization = organization(8L);
        UserEntity user = user(3L, "manager");
        OrganizationPermissionEntity permission = permission(5L, organization, user);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(permissionRepository.findByOrganizationId(8L, Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(permission)));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        when(permissionRepository.findByOrganizationIdAndUserId(8L, 3L))
                .thenReturn(Optional.of(permission));
        when(permissionRepository.save(permission)).thenReturn(permission);

        assertThat(service().findAll(8L, Pageable.ofSize(20)).getContent().getFirst())
                .satisfies(
                        result -> {
                            assertThat(result.id()).isEqualTo(5L);
                            assertThat(result.username()).isEqualTo("manager");
                            assertThat(result.permissionLevel())
                                    .isEqualTo(OrganizationPermissionLevel.MANAGE);
                        });

        var result =
                service()
                        .upsert(
                                8L,
                                new AdminOrganizationPermissionRequestDTO(
                                        3L, OrganizationPermissionLevel.MANAGE));

        assertThat(result.permissionLevel()).isEqualTo(OrganizationPermissionLevel.MANAGE);
        verify(auditEventService)
                .record(
                        "organization.permission.updated",
                        "organization",
                        "8",
                        "userId=3,level=MANAGE");
    }

    @Test
    void evaluatesViewAndManageAccessIncludingUnknownUsers() {
        UserEntity viewer = user(3L, "viewer");
        OrganizationPermissionEntity viewPermission = permission(5L, organization(8L), viewer);
        viewPermission.setPermissionLevel(OrganizationPermissionLevel.VIEW);
        when(userRepository.findByUsername("viewer")).thenReturn(Optional.of(viewer));
        when(permissionRepository.findByOrganizationIdAndUserId(8L, 3L))
                .thenReturn(Optional.of(viewPermission));

        assertThat(service().canView(8L, "viewer")).isTrue();
        assertThat(service().canManage(8L, "viewer")).isFalse();
        assertThat(service().canView(8L, null)).isFalse();

        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThat(service().canView(8L, "missing")).isFalse();

        viewPermission.setPermissionLevel(OrganizationPermissionLevel.MANAGE);
        assertThat(service().canView(8L, "viewer")).isTrue();
        assertThat(service().canManage(8L, "viewer")).isTrue();
    }

    @Test
    void rejectsUnknownOrganizationAndUser() {
        when(organizationRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().findAll(99L, Pageable.ofSize(20)))
                .isInstanceOf(ApiException.class);

        OrganizationEntity organization = organization(8L);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service()
                                        .upsert(
                                                8L,
                                                new AdminOrganizationPermissionRequestDTO(
                                                        99L, OrganizationPermissionLevel.VIEW)))
                .isInstanceOf(ApiException.class);
    }

    private OrganizationPermissionService service() {
        return new OrganizationPermissionService(
                organizationRepository, permissionRepository, userRepository, auditEventService);
    }

    private static OrganizationEntity organization(Long id) {
        OrganizationEntity organization = new OrganizationEntity();
        organization.setId(id);
        organization.setAlias("acme");
        organization.setName("Acme");
        return organization;
    }

    private static UserEntity user(Long id, String username) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        return user;
    }

    private static OrganizationPermissionEntity permission(
            Long id, OrganizationEntity organization, UserEntity user) {
        OrganizationPermissionEntity permission = new OrganizationPermissionEntity();
        permission.setId(id);
        permission.setOrganization(organization);
        permission.setUser(user);
        permission.setPermissionLevel(OrganizationPermissionLevel.MANAGE);
        return permission;
    }
}
