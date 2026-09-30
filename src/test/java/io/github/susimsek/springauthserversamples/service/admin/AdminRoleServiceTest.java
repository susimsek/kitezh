package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleUserDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminRoleMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRoleRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AdminRoleServiceTest {

    @Mock private AuthorityRepository authorityRepository;
    @Mock private UserRepository userRepository;
    @Mock private AdminAuditEventService adminAuditEventService;
    @Mock private AdminUserService adminUserService;
    @Mock private ClientRoleRepository clientRoleRepository;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private AdminRoleMapper adminRoleMapper;

    @Test
    void rolesReturnsMappedPage() {
        var pageable = PageRequest.of(0, 20);
        when(authorityRepository.findByNameContainingIgnoreCase("", pageable))
                .thenReturn(
                        new PageImpl<>(
                                java.util.List.of(
                                        authority(2L, "ROLE_ADMIN"), authority(3L, "ROLE_AUDITOR")),
                                pageable,
                                2));

        assertThat(service().roles("", pageable).getContent())
                .containsExactly(new AdminRoleDTO("ROLE_ADMIN"), new AdminRoleDTO("ROLE_AUDITOR"));
    }

    @Test
    void rejectsAnInvalidRoleName() {
        assertThatThrownBy(() -> service().createRole("role_user"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Role names must use ROLE_ uppercase format");
    }

    @Test
    void rejectsDuplicateRoleNames() {
        when(authorityRepository.existsByName("ROLE_AUDITOR")).thenReturn(true);

        assertThatThrownBy(() -> service().createRole("ROLE_AUDITOR"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Role is already registered");
    }

    @Test
    void createsRoleAndRecordsAuditEvent() {
        when(authorityRepository.existsByName("ROLE_AUDITOR")).thenReturn(false);
        when(authorityRepository.save(any(AuthorityEntity.class)))
                .thenAnswer(
                        invocation -> {
                            AuthorityEntity role = invocation.getArgument(0);
                            role.setId(9L);
                            return role;
                        });

        AdminRoleDTO created = service().createRole("ROLE_AUDITOR");

        assertThat(created).isEqualTo(new AdminRoleDTO("ROLE_AUDITOR"));
        verify(authorityRepository).save(any(AuthorityEntity.class));
        verify(adminAuditEventService).record("role.created", "role", "ROLE_AUDITOR");
    }

    @Test
    void createsRoleWithNormalizedDescription() {
        when(authorityRepository.existsByName("ROLE_AUDITOR")).thenReturn(false);
        when(authorityRepository.save(any(AuthorityEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AdminRoleDTO created = service().createRole("ROLE_AUDITOR", "  Reviews access  ");

        assertThat(created).isEqualTo(new AdminRoleDTO("ROLE_AUDITOR", "Reviews access"));
    }

    @Test
    void updatesRoleDescriptionAndRecordsAuditEvent() {
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));

        AdminRoleDTO updated = service().updateRole("ROLE_AUDITOR", "  Reviews access  ");

        assertThat(role.getDescription()).isEqualTo("Reviews access");
        assertThat(updated).isEqualTo(new AdminRoleDTO("ROLE_AUDITOR", "Reviews access"));
        verify(adminAuditEventService).record("role.updated", "role", "ROLE_AUDITOR");
    }

    @Test
    void deleteRoleRejectsMissingRole() {
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().deleteRole("ROLE_AUDITOR"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Role not found");
    }

    @Test
    void deleteRoleRejectsProtectedAdministratorRole() {
        when(authorityRepository.findByName(AuthoritiesConstants.ADMIN))
                .thenReturn(Optional.of(authority(1L, AuthoritiesConstants.ADMIN)));

        assertThatThrownBy(() -> service().deleteRole(AuthoritiesConstants.ADMIN))
                .isInstanceOf(ApiException.class)
                .hasMessage("Role cannot be removed");

        verify(authorityRepository, never()).delete(any(AuthorityEntity.class));
    }

    @Test
    void deleteRoleRejectsProtectedUserRole() {
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(authority(2L, AuthoritiesConstants.USER)));

        assertThatThrownBy(() -> service().deleteRole(AuthoritiesConstants.USER))
                .isInstanceOf(ApiException.class)
                .hasMessage("Role cannot be removed");

        verify(authorityRepository, never()).delete(any(AuthorityEntity.class));
    }

    @Test
    void deleteRoleRejectsAssignedCustomRole() {
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(userRepository.countByAuthoritiesId(4L)).thenReturn(2L);

        assertThatThrownBy(() -> service().deleteRole("ROLE_AUDITOR"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Role is assigned to one or more users");

        verify(authorityRepository, never()).delete(any(AuthorityEntity.class));
    }

    @Test
    void deletesAnUnassignedCustomRole() {
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(userRepository.countByAuthoritiesId(4L)).thenReturn(0L);

        service().deleteRole("ROLE_AUDITOR");

        verify(authorityRepository).delete(role);
        verify(adminAuditEventService).record("role.deleted", "role", "ROLE_AUDITOR");
    }

    @Test
    void searchesAssignedUsersOnTheServer() {
        UserEntity alice = new UserEntity();
        alice.setId(10L);
        alice.setUsername("alice");
        alice.setEnabled(true);
        var pageable = PageRequest.of(0, 20);
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(userRepository.findByAuthoritiesNameAndUsernameContainingIgnoreCase(
                        "ROLE_AUDITOR", "ali", pageable))
                .thenReturn(new PageImpl<>(List.of(alice), pageable, 1));
        when(userRepository.countByAuthoritiesId(4L)).thenReturn(1L);

        var result = service().role("ROLE_AUDITOR", "  ali  ", pageable);

        assertThat(result.users().getContent())
                .containsExactly(new AdminRoleUserDTO(10L, "alice", true));
        assertThat(result.userCount()).isEqualTo(1L);
    }

    @Test
    void searchesOnlyUsersNotAlreadyAssignedToRole() {
        UserEntity bob = new UserEntity();
        bob.setId(11L);
        bob.setUsername("bob");
        bob.setEnabled(true);
        var pageable = PageRequest.of(0, 10);
        when(authorityRepository.existsByName("ROLE_AUDITOR")).thenReturn(true);
        when(userRepository.findAvailableRoleUsers("ROLE_AUDITOR", "bo", pageable))
                .thenReturn(new PageImpl<>(List.of(bob), pageable, 1));

        assertThat(service().availableUsers("ROLE_AUDITOR", " bo ", pageable).getContent())
                .containsExactly(new AdminRoleUserDTO(11L, "bob", true));
    }

    @Test
    void fallsBackToRepositoryQueriesWhenEffectiveUsersAreUnavailable() {
        var pageable = PageRequest.of(0, 20);
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        UserEntity bob = user(11L, "bob", true, "bob@example.com");
        when(authorityRepository.existsByName("ROLE_AUDITOR")).thenReturn(true);
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(userRepository.findAllWithEffectiveAuthorities()).thenReturn(null);
        when(userRepository.findAvailableRoleUsers("ROLE_AUDITOR", "", pageable))
                .thenReturn(new PageImpl<>(List.of(bob), pageable, 1));
        when(userRepository.findByAuthoritiesNameAndUsernameContainingIgnoreCase(
                        "ROLE_AUDITOR", "", pageable))
                .thenReturn(new PageImpl<>(List.of(bob), pageable, 1));
        when(userRepository.countByAuthoritiesId(4L)).thenReturn(1L);

        assertThat(service().availableUsers("ROLE_AUDITOR", "", pageable).getTotalElements())
                .isEqualTo(1);
        assertThat(service().role("ROLE_AUDITOR", "", pageable).userCount()).isEqualTo(1L);
    }

    @Test
    void excludesUsersWhoAlreadyReceiveRoleFromAGroup() {
        UserEntity alice = new UserEntity();
        alice.setId(12L);
        alice.setUsername("alice");
        alice.setEnabled(true);
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        GroupEntity group = new GroupEntity();
        group.setAuthorities(java.util.Set.of(role));
        alice.setGroups(java.util.Set.of(group));
        when(authorityRepository.existsByName("ROLE_AUDITOR")).thenReturn(true);
        when(userRepository.findAllWithEffectiveAuthorities()).thenReturn(List.of(alice));

        assertThat(service().availableUsers("ROLE_AUDITOR", "", PageRequest.of(0, 10))).isEmpty();
        verify(userRepository, never()).findAvailableRoleUsers(any(), any(), any());
    }

    @Test
    void filtersAndSortsAssignedUsers() {
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        UserEntity alice = user(10L, "alice", true, "alice@example.com");
        UserEntity bob = user(11L, "bob", false, "bob@example.com");
        alice.setAuthorities(java.util.Set.of(role));
        bob.setAuthorities(java.util.Set.of(role));
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(userRepository.findAllWithEffectiveAuthorities()).thenReturn(List.of(alice, bob));

        var result =
                service()
                        .role(
                                "ROLE_AUDITOR",
                                "example.com",
                                true,
                                PageRequest.of(0, 10, Sort.by(Sort.Order.desc("username"))));

        assertThat(result.users().getContent())
                .containsExactly(new AdminRoleUserDTO(10L, "alice", true));
        assertThat(result.userCount()).isEqualTo(1L);
    }

    @Test
    void filtersAvailableUsersInMemoryAcrossSearchAndSortFields() {
        UserEntity alice = user(10L, "alice", true, "alice@example.com");
        alice.setFirstName("Alice");
        alice.setLastName("Zephyr");
        UserEntity bob = user(11L, "bob", true, "bob@example.com");
        bob.setFirstName("Bob");
        bob.setLastName("Yellow");
        when(authorityRepository.existsByName("ROLE_AUDITOR")).thenReturn(true);
        when(userRepository.findAllWithEffectiveAuthorities()).thenReturn(List.of(alice, bob));

        for (String property : List.of("email", "firstName", "lastName", "enabled", "unknown")) {
            assertThat(
                            service()
                                    .availableUsers(
                                            "ROLE_AUDITOR",
                                            "alice",
                                            PageRequest.of(
                                                    0, 10, Sort.by(Sort.Order.desc(property)))))
                    .extracting(AdminRoleUserDTO::username)
                    .containsExactly("alice");
        }
        assertThat(
                        service()
                                .availableUsers(
                                        "ROLE_AUDITOR",
                                        "",
                                        PageRequest.of(
                                                0,
                                                10,
                                                Sort.by(
                                                        Sort.Order.asc("email"),
                                                        Sort.Order.desc("lastName")))))
                .extracting(AdminRoleUserDTO::username)
                .containsExactly("alice", "bob");
    }

    @Test
    void assignsAndRemovesRoleThroughAdminUserService() {
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        var pageable = PageRequest.of(0, 20);
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(userRepository.findAllWithEffectiveAuthorities()).thenReturn(List.of());
        when(userRepository.findByAuthoritiesNameAndUsernameContainingIgnoreCase(
                        "ROLE_AUDITOR", "", pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));
        when(userRepository.countByAuthoritiesId(4L)).thenReturn(0L);

        service().assignUser("ROLE_AUDITOR", 10L, "admin", pageable);
        service().removeUser("ROLE_AUDITOR", 10L, "admin", pageable);

        verify(adminUserService).assignRole(10L, "ROLE_AUDITOR", "admin");
        verify(adminUserService).removeRole(10L, "ROLE_AUDITOR", "admin");
        verify(adminAuditEventService).record("role.user.assigned", "role", "ROLE_AUDITOR");
        verify(adminAuditEventService).record("role.user.removed", "role", "ROLE_AUDITOR");
    }

    @Test
    void listsAvailableRealmAndClientComposites() {
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        AuthorityEntity child = authority(5L, "ROLE_REPORTS");
        ClientRoleEntity clientRole =
                new ClientRoleEntity(
                        new io.github.susimsek.springauthserversamples.domain
                                .RegisteredClientEntity(),
                        "reports.read",
                        null);
        clientRole.setId(9L);
        PageRequest pageable = PageRequest.of(0, 20);
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(authorityRepository.findAvailableCompositeRoles("ROLE_AUDITOR", "report", pageable))
                .thenReturn(new PageImpl<>(List.of(child), pageable, 1));
        when(clientRoleRepository.findAvailableClientRolesForAuthorityComposite(
                        "ROLE_AUDITOR", "read", pageable))
                .thenReturn(new PageImpl<>(List.of(clientRole), pageable, 1));
        when(adminRoleMapper.toDTO(child)).thenReturn(new AdminRoleDTO("ROLE_REPORTS"));

        AdminRoleService service = extendedService();
        assertThat(service.availableComposites("ROLE_AUDITOR", " report ", pageable).getContent())
                .containsExactly(new AdminRoleDTO("ROLE_REPORTS"));
        assertThat(service.availableClientComposites("ROLE_AUDITOR", " read ", pageable))
                .hasSize(1);
    }

    @Test
    void addsAndRemovesRealmAndClientComposites() {
        AuthorityEntity role = authority(4L, "ROLE_AUDITOR");
        AuthorityEntity child = authority(5L, "ROLE_REPORTS");
        var client = new io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity();
        client.setClientId("orders-client");
        ClientRoleEntity clientRole = new ClientRoleEntity(client, "reports.read", null);
        clientRole.setId(9L);
        when(authorityRepository.findAllWithCompositeRoles()).thenReturn(List.of(role, child));
        when(authorityRepository.findByName("ROLE_AUDITOR")).thenReturn(Optional.of(role));
        when(authorityRepository.findByName("ROLE_REPORTS")).thenReturn(Optional.of(child));
        when(clientRoleRepository.findDetailedById(9L)).thenReturn(Optional.of(clientRole));
        when(userRepository.findAll()).thenReturn(List.of());
        stubRoleDetailQueries(role, 0L);
        PageRequest pageable = PageRequest.of(0, 20);
        AdminRoleService service = extendedService();

        service.addComposite("ROLE_AUDITOR", "ROLE_REPORTS", pageable);
        assertThat(role.getCompositeRoles()).containsExactly(child);
        service.removeComposite("ROLE_AUDITOR", "ROLE_REPORTS", pageable);
        assertThat(role.getCompositeRoles()).isEmpty();
        service.addClientComposite("ROLE_AUDITOR", 9L, pageable);
        assertThat(role.getCompositeClientRoles()).containsExactly(clientRole);
        service.removeClientComposite("ROLE_AUDITOR", 9L, pageable);
        assertThat(role.getCompositeClientRoles()).isEmpty();
    }

    private AdminRoleService service() {
        return new AdminRoleService(
                authorityRepository, userRepository, adminAuditEventService, adminUserService);
    }

    private AdminRoleService extendedService() {
        return new AdminRoleService(
                clientRoleRepository,
                authorityRepository,
                userRepository,
                adminAuditEventService,
                adminUserService,
                adminRoleMapper,
                userAccessInvalidationService);
    }

    private void stubRoleDetailQueries(AuthorityEntity role, long count) {
        PageRequest pageable = PageRequest.of(0, 20);
        when(userRepository.findAllWithEffectiveAuthorities()).thenReturn(List.of());
        when(userRepository.findByAuthoritiesNameAndUsernameContainingIgnoreCase(
                        role.getName(), "", pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, count));
        when(userRepository.countByAuthoritiesId(role.getId())).thenReturn(count);
    }

    private static AuthorityEntity authority(Long id, String name) {
        AuthorityEntity authority = new AuthorityEntity();
        authority.setId(id);
        authority.setName(name);
        return authority;
    }

    private static UserEntity user(Long id, String username, boolean enabled, String email) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        user.setEnabled(enabled);
        user.setEmail(email);
        return user;
    }
}
