package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.GroupPermissionEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminGroupPermissionDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminGroupPermissionRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminGroupPermissionsRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminGroupRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminGroupRolesRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminGroupMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.GroupPermissionRepository;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AdminGroupServiceTest {

    @Mock private GroupRepository groupRepository;
    @Mock private AuthorityRepository authorityRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private AdminAuditEventService adminAuditEventService;
    @Mock private GroupPermissionRepository groupPermissionRepository;

    @Test
    void findAllLoadsMemberCountsInOneBatch() {
        GroupEntity finance = group(7L, "finance");
        GroupEntity support = group(8L, "support");
        when(groupRepository.findByNameContainingIgnoreCase("", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(finance, support), Pageable.ofSize(20), 2));
        when(userRepository.countUsersByGroupIdIn(List.of(7L, 8L)))
                .thenReturn(List.of(groupUserCount(7L, 3L), groupUserCount(8L, 1L)));

        var result = service().findAll("", Pageable.ofSize(20));

        assertThat(result.getContent()).extracting("userCount").containsExactly(3L, 1L);
        verify(userRepository, never()).countByGroupsId(org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void administrativeUsersSeeAllGroupsThroughScopedFindAll() {
        GroupEntity finance = group(7L, "finance");
        UserEntity administrator = user(3L, "administrator");
        administrator.getAuthorities().add(authority("ROLE_ADMIN"));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(groupRepository.findByNameContainingIgnoreCase("", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(finance)));
        when(userRepository.countUsersByGroupIdIn(List.of(7L)))
                .thenReturn(List.of(groupUserCount(7L, 0L)));

        assertThat(
                        serviceWithPermissions()
                                .findAll("", Pageable.ofSize(20), "administrator")
                                .getContent())
                .extracting("name")
                .containsExactly("finance");
    }

    @Test
    void findsGroupByIdAndMapsItsMemberCount() {
        GroupEntity finance = group(7L, "finance");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(finance));
        when(userRepository.countByGroupsId(7L)).thenReturn(3L);

        assertThat(service().findById(7L).name()).isEqualTo("finance");
    }

    @Test
    void updateRolesInvalidatesEveryGroupMember() {
        GroupEntity group = group(7L, "finance");
        UserEntity alice = user(3L, "alice");
        UserEntity bob = user(4L, "bob");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(authorityRepository.findByNameIn(Set.of("ROLE_USER_VIEWER")))
                .thenReturn(List.of(authority("ROLE_USER_VIEWER")));
        when(userRepository.findAllByGroupsId(7L)).thenReturn(List.of(alice, bob));
        when(userRepository.countByGroupsId(7L)).thenReturn(2L);

        service().updateRoles(7L, new AdminGroupRolesRequestDTO(Set.of("ROLE_USER_VIEWER")));

        verify(userAccessInvalidationService).invalidate("alice");
        verify(userAccessInvalidationService).invalidate("bob");
    }

    @Test
    void updateRolesInvalidatesMembersOfNestedGroups() {
        GroupEntity parent = group(7L, "finance");
        GroupEntity child = group(8L, "operations");
        child.setParent(parent);
        UserEntity parentMember = user(3L, "alice");
        UserEntity childMember = user(4L, "bob");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(parent));
        when(groupRepository.findByParentId(7L)).thenReturn(List.of(child));
        when(groupRepository.findByParentId(8L)).thenReturn(List.of());
        when(authorityRepository.findByNameIn(Set.of("ROLE_USER_VIEWER")))
                .thenReturn(List.of(authority("ROLE_USER_VIEWER")));
        when(userRepository.findAllByGroupsId(7L)).thenReturn(List.of(parentMember));
        when(userRepository.findAllByGroupsId(8L)).thenReturn(List.of(childMember));
        when(userRepository.countByGroupsId(7L)).thenReturn(1L);

        service().updateRoles(7L, new AdminGroupRolesRequestDTO(Set.of("ROLE_USER_VIEWER")));

        verify(userAccessInvalidationService).invalidate("alice");
        verify(userAccessInvalidationService).invalidate("bob");
    }

    @Test
    void updateRejectsMovingGroupIntoItsDescendant() {
        GroupEntity parent = group(7L, "finance");
        GroupEntity child = group(8L, "operations");
        child.setParent(parent);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(parent));
        when(groupRepository.findById(8L)).thenReturn(Optional.of(child));

        assertThatThrownBy(() -> service().update(7L, new AdminGroupRequestDTO("finance", 8L)))
                .hasMessageContaining("descendant");
    }

    @Test
    void updatesGroupAndInvalidatesMembersInItsTree() {
        GroupEntity group = group(7L, "finance");
        UserEntity alice = user(3L, "alice");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(groupRepository.existsByName("operations")).thenReturn(false);
        when(userRepository.findAllByGroupsId(7L)).thenReturn(List.of(alice));
        when(groupRepository.findByParentId(7L)).thenReturn(List.of());
        when(userRepository.countByGroupsId(7L)).thenReturn(1L);

        var result =
                service()
                        .update(
                                7L,
                                new AdminGroupRequestDTO(
                                        "operations", null, java.util.Map.of(), false));

        assertThat(result.name()).isEqualTo("operations");
        verify(userAccessInvalidationService).invalidate("alice");
        verify(adminAuditEventService).record("group.updated", "group", "7");
    }

    @Test
    void rejectsDeletingGroupWithChildren() {
        GroupEntity group = group(7L, "finance");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(groupRepository.existsByParentId(7L)).thenReturn(true);

        assertThatThrownBy(() -> service().delete(7L)).hasMessageContaining("child groups");
        verify(groupRepository, never()).delete(group);
    }

    @Test
    void addUserInvalidatesTheAddedUsersAccess() {
        GroupEntity group = group(7L, "finance");
        UserEntity alice = user(3L, "alice");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(userRepository.findById(3L)).thenReturn(Optional.of(alice));
        when(userRepository.countByGroupsId(7L)).thenReturn(1L);

        service().addUser(7L, 3L);

        verify(userAccessInvalidationService).invalidate("alice");
    }

    @Test
    void removeUserInvalidatesTheRemovedUsersAccess() {
        GroupEntity group = group(7L, "finance");
        UserEntity alice = user(3L, "alice");
        alice.getGroups().add(group);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(userRepository.findById(3L)).thenReturn(Optional.of(alice));
        when(userRepository.countByGroupsId(7L)).thenReturn(0L);

        service().removeUser(7L, 3L);

        verify(userAccessInvalidationService).invalidate("alice");
    }

    @Test
    void deleteInvalidatesEveryFormerGroupMember() {
        GroupEntity group = group(7L, "finance");
        UserEntity alice = user(3L, "alice");
        UserEntity bob = user(4L, "bob");
        alice.getGroups().add(group);
        bob.getGroups().add(group);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(userRepository.findAllByGroupsId(7L)).thenReturn(List.of(alice, bob));

        serviceWithPermissions().delete(7L);

        verify(userAccessInvalidationService).invalidate("alice");
        verify(userAccessInvalidationService).invalidate("bob");
        verify(groupPermissionRepository).deleteByGroupId(7L);
        verify(groupRepository).delete(group);
    }

    @Test
    void createsGroupWithAttributesAndDefaultGroupFlag() {
        when(groupRepository.save(org.mockito.ArgumentMatchers.any(GroupEntity.class)))
                .thenAnswer(
                        invocation -> {
                            GroupEntity saved = invocation.getArgument(0);
                            saved.setId(9L);
                            return saved;
                        });
        when(userRepository.countByGroupsId(org.mockito.ArgumentMatchers.any())).thenReturn(0L);

        var result =
                service()
                        .create(
                                new AdminGroupRequestDTO(
                                        "finance",
                                        null,
                                        java.util.Map.of("department", List.of("finance")),
                                        true));

        assertThat(result.attributes()).containsEntry("department", List.of("finance"));
        assertThat(result.defaultGroup()).isTrue();
    }

    @Test
    void inheritedGroupPermissionAllowsAccessToNestedGroup() {
        GroupEntity parent = group(7L, "finance");
        GroupEntity child = group(8L, "operations");
        child.setParent(parent);
        UserEntity operator = user(3L, "operator");
        when(groupRepository.findById(8L)).thenReturn(Optional.of(child));
        when(userRepository.findByUsername("operator")).thenReturn(Optional.of(operator));
        when(groupPermissionRepository.existsForUserAndGroups(
                        3L, Set.of(8L, 7L), GroupPermission.VIEW))
                .thenReturn(true);

        var result = serviceWithPermissions().findById(8L, "operator");

        assertThat(result.id()).isEqualTo(8L);
    }

    @Test
    void listsOnlyGroupsVisibleThroughInheritedScopedPermissions() {
        GroupEntity finance = group(7L, "finance");
        GroupEntity operations = group(8L, "operations");
        operations.setParent(finance);
        GroupEntity unrelated = group(9L, "unrelated");
        UserEntity operator = user(3L, "operator");
        when(userRepository.findByUsername("operator")).thenReturn(Optional.of(operator));
        when(groupPermissionRepository.findGroupIdsByUserIdAndPermissions(3L, GroupPermission.ALL))
                .thenReturn(Set.of(7L));
        when(groupRepository.findAll()).thenReturn(List.of(unrelated, operations, finance));
        when(userRepository.countUsersByGroupIdIn(List.of(7L, 8L)))
                .thenReturn(List.of(groupUserCount(7L, 0L), groupUserCount(8L, 0L)));

        var result = serviceWithPermissions().findAll("", Pageable.ofSize(20), "operator");

        assertThat(result.getContent()).extracting("name").containsExactly("finance", "operations");
    }

    @Test
    void replacingGroupPermissionsInvalidatesOldAndNewSubjects() {
        GroupEntity group = group(7L, "finance");
        UserEntity alice = user(3L, "alice");
        UserEntity bob = user(4L, "bob");
        GroupPermissionEntity oldAssignment =
                new GroupPermissionEntity(group, alice, GroupPermission.VIEW);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(groupRepository.existsById(7L)).thenReturn(true);
        when(groupPermissionRepository.findByGroupIdOrderByUserUsernameAscPermissionAsc(7L))
                .thenReturn(List.of(oldAssignment), List.of());
        when(userRepository.findById(4L)).thenReturn(Optional.of(bob));

        serviceWithPermissions()
                .updatePermissions(
                        7L,
                        new AdminGroupPermissionsRequestDTO(
                                List.of(
                                        new AdminGroupPermissionRequestDTO(
                                                4L, GroupPermission.MANAGE_MEMBERS))));

        verify(userAccessInvalidationService).invalidate("alice");
        verify(userAccessInvalidationService).invalidate("bob");
        verify(groupPermissionRepository).deleteByGroupId(7L);
    }

    @Test
    void delegatesUserQueriesAndPermissionListing() {
        GroupEntity group = group(7L, "finance");
        UserEntity alice = user(3L, "alice");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(userRepository.findByGroupsIdAndUsernameContainingIgnoreCase(
                        7L, "ali", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(alice)));
        when(userRepository.findAvailableGroupUsers(7L, "ali", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of(alice)));
        GroupPermissionEntity permission =
                new GroupPermissionEntity(group, alice, GroupPermission.VIEW);
        when(groupRepository.existsById(7L)).thenReturn(true);
        when(groupPermissionRepository.findByGroupIdOrderByUserUsernameAscPermissionAsc(7L))
                .thenReturn(List.of(permission));

        assertThat(serviceWithPermissions().users(7L, " ali ", Pageable.ofSize(20)).getContent())
                .hasSize(1);
        assertThat(
                        serviceWithPermissions()
                                .availableUsers(7L, " ali ", Pageable.ofSize(20))
                                .getContent())
                .hasSize(1);
        assertThat(serviceWithPermissions().permissions(7L))
                .extracting(AdminGroupPermissionDTO::username)
                .containsExactly("alice");
    }

    @Test
    void supportsScopedOverloadsForAdministrativeUsers() {
        GroupEntity group = group(7L, "finance");
        UserEntity administrator = user(3L, "administrator");
        administrator.getAuthorities().add(authority("ROLE_ADMIN"));
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(userRepository.findByUsername("administrator")).thenReturn(Optional.of(administrator));
        when(groupRepository.findByParentId(7L)).thenReturn(List.of());
        when(userRepository.findAllByGroupsId(7L)).thenReturn(List.of());
        when(userRepository.countByGroupsId(7L)).thenReturn(0L);
        when(authorityRepository.findByNameIn(Set.of())).thenReturn(List.of());
        when(userRepository.findByGroupsIdAndUsernameContainingIgnoreCase(
                        7L, "", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of()));
        when(userRepository.findAvailableGroupUsers(7L, "", Pageable.ofSize(20)))
                .thenReturn(new PageImpl<>(List.of()));
        when(userRepository.findById(3L)).thenReturn(Optional.of(administrator));
        when(groupRepository.existsByParentId(7L)).thenReturn(false);

        AdminGroupService service = serviceWithPermissions();
        service.update(7L, new AdminGroupRequestDTO("finance", null), "administrator");
        service.updateRoles(7L, new AdminGroupRolesRequestDTO(Set.of()), "administrator");
        service.users(7L, "", Pageable.ofSize(20), "administrator");
        service.availableUsers(7L, "", Pageable.ofSize(20), "administrator");
        service.addUser(7L, 3L, "administrator");
        service.removeUser(7L, 3L, "administrator");
        service.delete(7L, "administrator");

        verify(groupRepository).delete(group);
    }

    @Test
    void validatesGroupNamesAttributesParentsAndRoles() {
        when(groupRepository.existsByName("finance")).thenReturn(true);
        assertThatThrownBy(() -> service().create(new AdminGroupRequestDTO(" finance ", null)))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> service().create(new AdminGroupRequestDTO(" ", null)))
                .isInstanceOf(RuntimeException.class);

        GroupEntity group = group(7L, "finance");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        assertThatThrownBy(() -> service().update(7L, new AdminGroupRequestDTO("finance", 7L)))
                .isInstanceOf(RuntimeException.class);

        when(authorityRepository.findByNameIn(Set.of("ROLE_UNKNOWN"))).thenReturn(List.of());
        assertThatThrownBy(
                        () ->
                                service()
                                        .updateRoles(
                                                7L,
                                                new AdminGroupRolesRequestDTO(
                                                        Set.of("ROLE_UNKNOWN"))))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void rejectsInvalidPermissionsAndMissingEntities() {
        when(groupRepository.findById(7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().findById(7L)).isInstanceOf(RuntimeException.class);

        GroupEntity existing = group(7L, "finance");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(existing));
        when(userRepository.findById(3L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().addUser(7L, 3L)).isInstanceOf(RuntimeException.class);

        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(
                        () -> serviceWithPermissions().findAll("", Pageable.ofSize(20), "missing"))
                .isInstanceOf(RuntimeException.class);

        GroupEntity group = group(7L, "finance");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(groupPermissionRepository.findByGroupIdOrderByUserUsernameAscPermissionAsc(7L))
                .thenReturn(List.of());
        assertThatThrownBy(
                        () ->
                                serviceWithPermissions()
                                        .updatePermissions(
                                                7L,
                                                new AdminGroupPermissionsRequestDTO(
                                                        List.of(
                                                                new AdminGroupPermissionRequestDTO(
                                                                        3L, "invalid")))))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void returnsEmptyPermissionListsWhenPermissionRepositoryIsUnavailable() {
        when(groupRepository.existsById(7L)).thenReturn(true);
        GroupEntity group = group(7L, "finance");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));

        assertThat(service().permissions(7L)).isEmpty();
        assertThat(service().updatePermissions(7L, new AdminGroupPermissionsRequestDTO(List.of())))
                .isEmpty();
    }

    @Test
    void permitsAdministrativeRoleAndDeniesUnassignedScopedUser() {
        GroupEntity parent = group(7L, "finance");
        GroupEntity child = group(8L, "operations");
        child.setParent(parent);
        UserEntity manager = user(3L, "manager");
        final AuthorityEntity admin = authority("ROLE_ADMIN");
        when(groupRepository.findById(8L)).thenReturn(Optional.of(child));
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(manager));
        when(groupPermissionRepository.existsForUserAndGroups(
                        3L, Set.of(8L, 7L), GroupPermission.VIEW))
                .thenReturn(false);
        assertThatThrownBy(() -> serviceWithPermissions().findById(8L, "manager"))
                .isInstanceOf(RuntimeException.class);

        org.mockito.Mockito.clearInvocations(groupPermissionRepository);
        manager.getAuthorities().clear();
        manager.getAuthorities().add(admin);
        when(userRepository.countByGroupsId(8L)).thenReturn(0L);
        assertThat(serviceWithPermissions().findById(8L, "manager").id()).isEqualTo(8L);
        verify(groupPermissionRepository, never())
                .existsForUserAndGroups(3L, Set.of(8L, 7L), GroupPermission.VIEW);
    }

    @Test
    void coversOptionalPermissionRepositoryAndRemainingGroupValidationBranches() {
        Pageable pageable = Pageable.ofSize(20);
        when(groupRepository.findByNameContainingIgnoreCase("", pageable))
                .thenReturn(new PageImpl<>(List.of()));
        assertThat(service().findAll("", pageable, "operator")).isEmpty();

        GroupEntity group = group(7L, "finance");
        GroupEntity unrelatedParent = group(8L, "operations");
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(groupRepository.findById(8L)).thenReturn(Optional.of(unrelatedParent));
        when(userRepository.findAllByGroupsId(7L)).thenReturn(List.of());
        when(groupRepository.existsByParentId(7L)).thenReturn(false);
        service().delete(7L);
        verify(groupRepository).delete(group);

        service().update(7L, new AdminGroupRequestDTO("finance", 8L, Map.of(), false));
        assertThat(group.getParent()).isSameAs(unrelatedParent);

        UserEntity manager = user(3L, "manager");
        manager.getAuthorities().add(authority("ROLE_USER_MANAGER"));
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(manager));
        when(userRepository.countByGroupsId(7L)).thenReturn(0L);
        assertThat(serviceWithPermissions().findById(7L, "manager").id()).isEqualTo(7L);

        List<Map<String, List<String>>> invalidAttributes =
                List.of(
                        Map.of("", List.of("value")),
                        Map.of("attribute", List.of()),
                        Map.of("attribute", List.of("")),
                        Map.of("attribute", List.of("x".repeat(1001))));
        when(groupRepository.existsByName("attributes-test")).thenReturn(false);
        for (Map<String, List<String>> attributes : invalidAttributes) {
            assertThatThrownBy(
                            () ->
                                    service()
                                            .create(
                                                    new AdminGroupRequestDTO(
                                                            "attributes-test",
                                                            null,
                                                            attributes,
                                                            false)))
                    .isInstanceOf(ApiException.class);
        }

        java.util.Map<String, List<String>> nullValues = new java.util.LinkedHashMap<>();
        nullValues.put("attribute", null);
        java.util.Map<String, List<String>> nullItem = new java.util.LinkedHashMap<>();
        nullItem.put("attribute", java.util.Collections.singletonList(null));
        java.util.Map<String, List<String>> longName = new java.util.LinkedHashMap<>();
        longName.put("x".repeat(101), List.of("value"));
        java.util.Map<String, List<String>> tooManyValues = new java.util.LinkedHashMap<>();
        tooManyValues.put("attribute", java.util.Collections.nCopies(21, "value"));
        for (Map<String, List<String>> attributes :
                List.of(nullValues, nullItem, longName, tooManyValues)) {
            assertThatThrownBy(
                            () ->
                                    service()
                                            .create(
                                                    new AdminGroupRequestDTO(
                                                            "attributes-test",
                                                            null,
                                                            attributes,
                                                            false)))
                    .isInstanceOf(ApiException.class);
        }

        GroupEntity descendant = group(9L, "child");
        descendant.setParent(group);
        when(groupRepository.findById(9L)).thenReturn(Optional.of(descendant));
        assertThatThrownBy(
                        () ->
                                service()
                                        .update(
                                                7L,
                                                new AdminGroupRequestDTO(
                                                        "finance", 9L, Map.of(), false)))
                .isInstanceOf(ApiException.class);
    }

    private AdminGroupService service() {
        return new AdminGroupService(
                groupRepository,
                authorityRepository,
                userRepository,
                userAccessInvalidationService,
                adminAuditEventService);
    }

    private AdminGroupService serviceWithPermissions() {
        return new AdminGroupService(
                groupRepository,
                authorityRepository,
                userRepository,
                userAccessInvalidationService,
                adminAuditEventService,
                org.mapstruct.factory.Mappers.getMapper(AdminGroupMapper.class),
                groupPermissionRepository);
    }

    private static GroupEntity group(Long id, String name) {
        GroupEntity group = new GroupEntity();
        group.setId(id);
        group.setName(name);
        return group;
    }

    private static UserEntity user(Long id, String username) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        return user;
    }

    private static AuthorityEntity authority(String name) {
        AuthorityEntity authority = new AuthorityEntity();
        authority.setName(name);
        return authority;
    }

    private static UserRepository.GroupUserCount groupUserCount(Long groupId, long userCount) {
        return new UserRepository.GroupUserCount() {
            @Override
            public Long getGroupId() {
                return groupId;
            }

            @Override
            public long getUserCount() {
                return userCount;
            }
        };
    }
}
