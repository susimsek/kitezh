package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleGroupDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleUserDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminRoleMapper;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRoleRepository;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@ExtendWith(MockitoExtension.class)
class AdminClientRoleServiceTest {

    @Mock private ClientRepository clientRepository;
    @Mock private ClientRoleRepository clientRoleRepository;
    @Mock private UserRepository userRepository;
    @Mock private GroupRepository groupRepository;
    @Mock private UserAccessInvalidationService invalidationService;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private AdminRoleMapper roleMapper;

    @Test
    void createsNormalizedClientRole() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        when(clientRepository.findById("orders-client")).thenReturn(Optional.of(client));
        when(clientRoleRepository.existsByClientIdAndName("orders-client", "orders.read"))
                .thenReturn(false);
        when(clientRoleRepository.save(any(ClientRoleEntity.class)))
                .thenAnswer(
                        invocation -> {
                            ClientRoleEntity role = invocation.getArgument(0);
                            role.setId(12L);
                            return role;
                        });

        var result =
                service()
                        .create(
                                "orders-client",
                                new AdminClientRoleRequestDTO(" orders.read ", " Read orders "));

        assertThat(result.id()).isEqualTo(12L);
        assertThat(result.clientId()).isEqualTo("Orders");
        assertThat(result.name()).isEqualTo("orders.read");
        assertThat(result.description()).isEqualTo("Read orders");
        verify(auditEventService).record("client-role.created", "client-role", "12");
    }

    @Test
    void rejectsDuplicateClientRoleNames() {
        when(clientRepository.findById("orders-client"))
                .thenReturn(Optional.of(client("orders-client", "Orders")));
        when(clientRoleRepository.existsByClientIdAndName("orders-client", "orders.read"))
                .thenReturn(true);

        AdminClientRoleService clientRoleService = service();
        AdminClientRoleRequestDTO request = new AdminClientRoleRequestDTO("orders.read", null);
        assertThatThrownBy(() -> clientRoleService.create("orders-client", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client role already exists");
        verify(clientRoleRepository, never()).save(any());
    }

    @Test
    void rejectsInvalidClientRoleNames() {
        when(clientRepository.findById("orders-client"))
                .thenReturn(Optional.of(client("orders-client", "Orders")));

        AdminClientRoleService clientRoleService = service();
        AdminClientRoleRequestDTO request = new AdminClientRoleRequestDTO("orders read", null);
        assertThatThrownBy(() -> clientRoleService.create("orders-client", request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client role name is invalid");
        verify(clientRoleRepository, never()).existsByClientIdAndName(any(), any());
    }

    @Test
    void findsRolesWithNormalizedSearchText() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        PageRequest pageable = PageRequest.of(0, 20, Sort.by("name"));
        when(clientRepository.findById("orders-client")).thenReturn(Optional.of(client));
        when(clientRoleRepository.findByClientIdAndNameContainingIgnoreCase(
                        "orders-client", "orders", pageable))
                .thenReturn(new PageImpl<>(List.of(role), pageable, 1));

        var result = service().findAll("orders-client", " orders ", pageable);

        assertThat(result.getContent()).extracting("name").containsExactly("orders.read");
        assertThat(result.getContent().getFirst().clientId()).isEqualTo("Orders");
    }

    @Test
    void findsRoleDetailWithNestedGroupPath() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setEnabled(true);
        GroupEntity parent = group(8L, "Finance");
        GroupEntity child = group(9L, "Operations");
        child.setParent(parent);
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        role.getGroups().add(child);
        PageRequest pageable = PageRequest.of(0, 20, Sort.by("username"));
        PageRequest groupPageable = PageRequest.of(0, 20, Sort.by("name"));
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(userRepository.findByClientRolesIdAndUsernameContainingIgnoreCase(
                        12L, "alice", pageable))
                .thenReturn(new PageImpl<>(List.of(user), pageable, 1));
        when(roleMapper.toUserDTO(user)).thenReturn(new AdminRoleUserDTO(7L, "alice", true));
        when(groupRepository.findByClientRolesIdAndNameContainingIgnoreCase(
                        12L, "alice", groupPageable))
                .thenReturn(new PageImpl<>(List.of(child), groupPageable, 1));
        when(userRepository.countByClientRolesId(12L)).thenReturn(1L);

        var result = service().findOne("orders-client", 12L, " alice ", pageable);

        assertThat(result.users().getContent()).extracting("username").containsExactly("alice");
        assertThat(result.groups().getContent())
                .extracting(AdminClientRoleGroupDTO::path)
                .containsExactly("Finance / Operations");
        assertThat(result.userCount()).isEqualTo(1L);
        assertThat(result.groupCount()).isEqualTo(1L);
    }

    @Test
    void listsAvailableUsersAndGroups() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        GroupEntity group = group(8L, "Operations");
        PageRequest pageable = PageRequest.of(0, 10, Sort.by("username"));
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(userRepository.findAvailableClientRoleUsers(12L, "alice", pageable))
                .thenReturn(new PageImpl<>(List.of(user), pageable, 1));
        when(roleMapper.toUserDTO(user)).thenReturn(new AdminRoleUserDTO(7L, "alice", false));
        when(groupRepository.findAvailableClientRoleGroups(12L, "ops", pageable))
                .thenReturn(new PageImpl<>(List.of(group), pageable, 1));

        var users = service().availableUsers("orders-client", 12L, " alice ", pageable);
        var groups = service().availableGroups("orders-client", 12L, " ops ", pageable);

        assertThat(users.getContent()).containsExactly(new AdminRoleUserDTO(7L, "alice", false));
        assertThat(groups.getContent())
                .containsExactly(new AdminClientRoleGroupDTO(8L, "Operations", "Operations"));
    }

    @Test
    void updatesRoleAndNormalizesBlankDescription() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));

        var result =
                service()
                        .update(
                                "orders-client",
                                12L,
                                new AdminClientRoleRequestDTO(" orders.read ", "   "));

        assertThat(result.name()).isEqualTo("orders.read");
        assertThat(result.description()).isNull();
        verify(auditEventService).record("client-role.updated", "client-role", "12");
    }

    @Test
    void rejectsRenamingRoleToExistingName() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(clientRoleRepository.existsByClientIdAndName("orders-client", "orders.write"))
                .thenReturn(true);

        AdminClientRoleService clientRoleService = service();
        AdminClientRoleRequestDTO request = new AdminClientRoleRequestDTO("orders.write", null);
        assertThatThrownBy(() -> clientRoleService.update("orders-client", 12L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client role already exists");
        assertThat(role.getName()).isEqualTo("orders.read");
    }

    @Test
    void assigningUserInvalidatesAccessAndReturnsUpdatedDetail() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(userRepository.findByClientRolesIdAndUsernameContainingIgnoreCase(
                        12L, "", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(java.util.List.of(), PageRequest.of(0, 20), 1));
        when(groupRepository.findByClientRolesIdAndNameContainingIgnoreCase(
                        12L, "", PageRequest.of(0, 20, Sort.by("name"))))
                .thenReturn(
                        new PageImpl<>(
                                java.util.List.of(), PageRequest.of(0, 20, Sort.by("name")), 0));
        when(userRepository.countByClientRolesId(12L)).thenReturn(1L);

        var result = service().assignUser("orders-client", 12L, 7L, PageRequest.of(0, 20));

        assertThat(user.getClientRoles()).containsExactly(role);
        assertThat(result.userCount()).isEqualTo(1L);
        verify(invalidationService).invalidateForCurrentPrincipal("alice");
        verify(auditEventService).record("client-role.user.assigned", "client-role", "12");
    }

    @Test
    void assigningGroupInvalidatesMembersAndReturnsUpdatedDetail() {
        GroupEntity group = new GroupEntity();
        group.setId(8L);
        group.setName("Operations");
        UserEntity member = new UserEntity();
        member.setUsername("alice");
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(groupRepository.findById(8L)).thenReturn(Optional.of(group));
        when(userRepository.findAllByGroupsId(8L)).thenReturn(java.util.List.of(member));
        when(userRepository.findByClientRolesIdAndUsernameContainingIgnoreCase(
                        12L, "", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(java.util.List.of(), PageRequest.of(0, 20), 0));
        when(groupRepository.findByClientRolesIdAndNameContainingIgnoreCase(
                        12L, "", PageRequest.of(0, 20, Sort.by("name"))))
                .thenReturn(
                        new PageImpl<>(
                                java.util.List.of(group),
                                PageRequest.of(0, 20, Sort.by("name")),
                                1));
        when(userRepository.countByClientRolesId(12L)).thenReturn(0L);

        var result = service().assignGroup("orders-client", 12L, 8L, PageRequest.of(0, 20));

        assertThat(group.getClientRoles()).containsExactly(role);
        assertThat(result.groupCount()).isEqualTo(1L);
        verify(invalidationService).invalidateForCurrentPrincipal("alice");
        verify(auditEventService).record("client-role.group.assigned", "client-role", "12");
    }

    @Test
    void doesNotRepeatUserAssignment() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.getClientRoles().add(role);
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        stubDetailQueries(role, 1L, List.of());

        service().assignUser("orders-client", 12L, 7L, PageRequest.of(0, 20));

        verifyNoInteractions(invalidationService, auditEventService);
    }

    @Test
    void removesUserAssignmentAndInvalidatesAccess() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.getClientRoles().add(role);
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        stubDetailQueries(role, 0L, List.of());

        service().removeUser("orders-client", 12L, 7L, PageRequest.of(0, 20));

        assertThat(user.getClientRoles()).doesNotContain(role);
        verify(invalidationService).invalidateForCurrentPrincipal("alice");
        verify(auditEventService).record("client-role.user.removed", "client-role", "12");
    }

    @Test
    void doesNotRepeatUserRemoval() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        stubDetailQueries(role, 0L, List.of());

        service().removeUser("orders-client", 12L, 7L, PageRequest.of(0, 20));

        verifyNoInteractions(invalidationService, auditEventService);
    }

    @Test
    void doesNotRepeatGroupAssignment() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        GroupEntity group = group(8L, "Operations");
        group.getClientRoles().add(role);
        role.getGroups().add(group);
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(groupRepository.findById(8L)).thenReturn(Optional.of(group));
        stubDetailQueries(role, 0L, List.of(group));

        service().assignGroup("orders-client", 12L, 8L, PageRequest.of(0, 20));

        verifyNoInteractions(invalidationService, auditEventService);
    }

    @Test
    void removesGroupAssignmentAndInvalidatesMembers() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        GroupEntity group = group(8L, "Operations");
        UserEntity member = new UserEntity();
        member.setUsername("alice");
        group.getClientRoles().add(role);
        role.getGroups().add(group);
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(groupRepository.findById(8L)).thenReturn(Optional.of(group));
        when(userRepository.findAllByGroupsId(8L)).thenReturn(List.of(member));
        stubDetailQueries(role, 0L, List.of());

        service().removeGroup("orders-client", 12L, 8L, PageRequest.of(0, 20));

        assertThat(group.getClientRoles()).doesNotContain(role);
        assertThat(role.getGroups()).doesNotContain(group);
        verify(invalidationService).invalidateForCurrentPrincipal("alice");
        verify(auditEventService).record("client-role.group.removed", "client-role", "12");
    }

    @Test
    void doesNotRepeatGroupRemoval() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        GroupEntity group = group(8L, "Operations");
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));
        when(groupRepository.findById(8L)).thenReturn(Optional.of(group));
        stubDetailQueries(role, 0L, List.of());

        service().removeGroup("orders-client", 12L, 8L, PageRequest.of(0, 20));

        verifyNoInteractions(invalidationService, auditEventService);
    }

    @Test
    void refusesDeletingAnAssignedClientRole() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        role.setUsers(java.util.Set.of(user));
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));

        AdminClientRoleService clientRoleService = service();
        assertThatThrownBy(() -> clientRoleService.delete("orders-client", 12L))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client role is assigned to one or more users or groups");
        verify(clientRoleRepository, never()).delete(any(ClientRoleEntity.class));
    }

    @Test
    void refusesDeletingAGroupAssignedClientRole() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        role.setGroups(Set.of(group(8L, "Operations")));
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));

        AdminClientRoleService clientRoleService = service();
        assertThatThrownBy(() -> clientRoleService.delete("orders-client", 12L))
                .isInstanceOf(ApiException.class)
                .hasMessage("Client role is assigned to one or more users or groups");
        verify(clientRoleRepository, never()).delete(any(ClientRoleEntity.class));
    }

    @Test
    void deletesUnassignedClientRole() {
        RegisteredClientEntity client = client("orders-client", "Orders");
        ClientRoleEntity role = role(client, 12L, "orders.read");
        when(clientRoleRepository.findDetailedById(12L)).thenReturn(Optional.of(role));

        service().delete("orders-client", 12L);

        verify(clientRoleRepository).delete(role);
        verify(auditEventService).record("client-role.deleted", "client-role", "12");
        verifyNoInteractions(invalidationService);
    }

    private AdminClientRoleService service() {
        return new AdminClientRoleService(
                clientRepository,
                clientRoleRepository,
                userRepository,
                groupRepository,
                invalidationService,
                auditEventService,
                roleMapper);
    }

    private static RegisteredClientEntity client(String id, String clientId) {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId(id);
        client.setClientId(clientId);
        return client;
    }

    private static GroupEntity group(Long id, String name) {
        GroupEntity group = new GroupEntity();
        group.setId(id);
        group.setName(name);
        return group;
    }

    private void stubDetailQueries(
            ClientRoleEntity role, long userCount, List<GroupEntity> groups) {
        PageRequest userPageable = PageRequest.of(0, 20);
        PageRequest groupPageable = PageRequest.of(0, 20, Sort.by("name"));
        when(userRepository.findByClientRolesIdAndUsernameContainingIgnoreCase(
                        role.getId(), "", userPageable))
                .thenReturn(new PageImpl<>(List.of(), userPageable, userCount));
        when(groupRepository.findByClientRolesIdAndNameContainingIgnoreCase(
                        role.getId(), "", groupPageable))
                .thenReturn(new PageImpl<>(groups, groupPageable, groups.size()));
        when(userRepository.countByClientRolesId(role.getId())).thenReturn(userCount);
    }

    private static ClientRoleEntity role(RegisteredClientEntity client, Long id, String name) {
        ClientRoleEntity role = new ClientRoleEntity(client, name, null);
        role.setId(id);
        return role;
    }
}
