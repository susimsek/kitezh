package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.ClientRoleEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import java.util.Set;
import org.junit.jupiter.api.Test;

class EffectiveRoleServiceTest {

    @Test
    void resolvesAssignedGroupAndParentRoles() {
        GroupEntity parent = group(1L, "finance", "ROLE_ADMIN");
        GroupEntity child = group(2L, "operations", "ROLE_USER_VIEWER");
        child.setParent(parent);

        UserEntity user = new UserEntity();
        user.setAuthorities(Set.of(authority(3L, "ROLE_USER")));
        user.setGroups(Set.of(child));

        var roles = EffectiveRoleService.resolve(user);

        assertThat(roles.assignedRoles()).containsExactly("ROLE_USER");
        assertThat(roles.inheritedRoles())
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_USER_VIEWER");
        assertThat(roles.effectiveRoles())
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_USER", "ROLE_USER_VIEWER");
        assertThat(roles.groupMappings())
                .singleElement()
                .satisfies(
                        mapping -> {
                            assertThat(mapping.groupPath()).isEqualTo("/finance/operations");
                            assertThat(mapping.roles())
                                    .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_USER_VIEWER");
                        });
    }

    @Test
    void resolvesNestedRealmCompositeRolesForUsersAndGroups() {
        AuthorityEntity viewer = authority(1L, "ROLE_VIEWER");
        AuthorityEntity operator = authority(2L, "ROLE_OPERATOR");
        AuthorityEntity administrator = authority(3L, "ROLE_ADMINISTRATOR");
        operator.setCompositeRoles(Set.of(viewer));
        administrator.setCompositeRoles(Set.of(operator));

        UserEntity user = new UserEntity();
        user.setAuthorities(Set.of(administrator));

        assertThat(EffectiveRoleService.effectiveRoleNames(user))
                .containsExactlyInAnyOrder("ROLE_ADMINISTRATOR", "ROLE_OPERATOR", "ROLE_VIEWER");
    }

    @Test
    void resolvesClientRolesByClientAndIncludesParentGroupMappings() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setClientId("orders-api");
        ClientRoleEntity direct = clientRole(client, "orders.read");
        ClientRoleEntity inherited = clientRole(client, "orders.write");
        GroupEntity parent = new GroupEntity();
        parent.setClientRoles(Set.of(inherited));
        GroupEntity child = new GroupEntity();
        child.setParent(parent);

        UserEntity user = new UserEntity();
        user.setClientRoles(Set.of(direct));
        user.setGroups(Set.of(child));

        assertThat(EffectiveRoleService.effectiveClientRoleNames(user))
                .containsEntry("orders-api", Set.of("orders.read", "orders.write"));
    }

    @Test
    void resolvesNestedClientCompositeRoles() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setClientId("orders-api");
        ClientRoleEntity read = clientRole(client, "orders.read");
        ClientRoleEntity write = clientRole(client, "orders.write");
        ClientRoleEntity manage = clientRole(client, "orders.manage");
        manage.setCompositeRoles(Set.of(read, write));

        UserEntity user = new UserEntity();
        user.setClientRoles(Set.of(manage));

        assertThat(EffectiveRoleService.effectiveClientRoleNames(user))
                .containsEntry(
                        "orders-api", Set.of("orders.manage", "orders.read", "orders.write"));
    }

    @Test
    void resolvesCrossScopeCompositeRoles() {
        RegisteredClientEntity ordersClient = new RegisteredClientEntity();
        ordersClient.setClientId("orders-api");
        AuthorityEntity administrator = authority(1L, "ROLE_ADMINISTRATOR");
        ClientRoleEntity ordersRead = clientRole(ordersClient, "orders.read");
        administrator.setCompositeClientRoles(Set.of(ordersRead));

        UserEntity user = new UserEntity();
        user.setAuthorities(Set.of(administrator));

        assertThat(EffectiveRoleService.effectiveRoleNames(user))
                .containsExactly("ROLE_ADMINISTRATOR");
        assertThat(EffectiveRoleService.effectiveClientRoleNames(user))
                .containsEntry("orders-api", Set.of("orders.read"));
    }

    @Test
    void resolvesClientToRealmAndCrossClientCompositeRoles() {
        RegisteredClientEntity ordersClient = new RegisteredClientEntity();
        ordersClient.setClientId("orders-api");
        RegisteredClientEntity billingClient = new RegisteredClientEntity();
        billingClient.setClientId("billing-api");
        ClientRoleEntity ordersManage = clientRole(ordersClient, "orders.manage");
        ClientRoleEntity billingRead = clientRole(billingClient, "billing.read");
        AuthorityEntity auditor = authority(1L, "ROLE_AUDITOR");
        ordersManage.setCompositeRealmRoles(Set.of(auditor));
        ordersManage.setCompositeRoles(Set.of(billingRead));

        UserEntity user = new UserEntity();
        user.setClientRoles(Set.of(ordersManage));

        assertThat(EffectiveRoleService.effectiveRoleNames(user)).containsExactly("ROLE_AUDITOR");
        assertThat(EffectiveRoleService.effectiveClientRoleNames(user))
                .containsEntry("orders-api", Set.of("orders.manage"))
                .containsEntry("billing-api", Set.of("billing.read"));
    }

    @Test
    void detectsAReachableCompositeRole() {
        AuthorityEntity parent = authority(1L, "ROLE_PARENT");
        AuthorityEntity child = authority(2L, "ROLE_CHILD");
        parent.setCompositeRoles(Set.of(child));

        assertThat(EffectiveRoleService.reaches(parent, child)).isTrue();
        assertThat(EffectiveRoleService.reaches(child, parent)).isFalse();
    }

    @Test
    void detectsReachableCrossScopeCompositeRoles() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setClientId("orders-api");
        AuthorityEntity realmRole = authority(1L, "ROLE_PARENT");
        ClientRoleEntity clientRole = clientRole(client, "orders.read");
        realmRole.setCompositeClientRoles(Set.of(clientRole));

        assertThat(EffectiveRoleService.reaches(realmRole, clientRole)).isTrue();
        assertThat(EffectiveRoleService.reaches(clientRole, realmRole)).isFalse();

        clientRole.setCompositeRealmRoles(Set.of(realmRole));

        assertThat(EffectiveRoleService.reaches(clientRole, realmRole)).isTrue();
    }

    @Test
    void handlesNullRoleCollectionsAndCyclesSafely() {
        UserEntity empty = new UserEntity();
        empty.setAuthorities(null);
        empty.setClientRoles(null);
        empty.setGroups(null);

        assertThat(EffectiveRoleService.resolve(empty).effectiveRoles()).isEmpty();
        assertThat(EffectiveRoleService.effectiveClientRoleNames(empty)).isEmpty();
        assertThat(EffectiveRoleService.expandScopeRoles(null, null).applicationRoles()).isEmpty();
        assertThat(EffectiveRoleService.reaches((AuthorityEntity) null, (AuthorityEntity) null))
                .isFalse();

        AuthorityEntity first = authority(1L, "ROLE_FIRST");
        AuthorityEntity second = authority(2L, "ROLE_SECOND");
        first.setCompositeRoles(Set.of(second));
        second.setCompositeRoles(Set.of(first));
        GroupEntity group = new GroupEntity();
        group.setName("cycle");
        group.setParent(group);
        group.setAuthorities(Set.of(first));
        UserEntity cyclic = new UserEntity();
        cyclic.setAuthorities(Set.of());
        cyclic.setGroups(Set.of(group));

        assertThat(EffectiveRoleService.effectiveRoleNames(cyclic))
                .containsExactlyInAnyOrder("ROLE_FIRST", "ROLE_SECOND");
    }

    @Test
    void detectsClientRoleToClientRoleReachability() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setClientId("orders-api");
        ClientRoleEntity parent = clientRole(client, "orders.manage");
        ClientRoleEntity child = clientRole(client, "orders.read");
        parent.setCompositeRoles(Set.of(child));

        assertThat(EffectiveRoleService.reaches(parent, child)).isTrue();
        assertThat(EffectiveRoleService.reaches(child, parent)).isFalse();
    }

    @Test
    void ignoresIncompleteRolesAndNullCompositeEntries() {
        AuthorityEntity unnamedAuthority = authority(9L, "ROLE_SAFE");
        java.util.Set<AuthorityEntity> authorities = new java.util.LinkedHashSet<>();
        authorities.add(unnamedAuthority);
        ClientRoleEntity incompleteClientRole = new ClientRoleEntity(null, null, null);
        java.util.Set<ClientRoleEntity> clientRoles = new java.util.LinkedHashSet<>();
        clientRoles.add(incompleteClientRole);
        clientRoles.add(null);

        UserEntity user = new UserEntity();
        user.setAuthorities(authorities);
        user.setClientRoles(clientRoles);

        assertThat(EffectiveRoleService.effectiveRoleNames(user)).containsExactly("ROLE_SAFE");
        assertThat(EffectiveRoleService.effectiveClientRoleNames(user)).isEmpty();
        assertThat(EffectiveRoleService.expandScopeRoles(authorities, clientRoles))
                .extracting(EffectiveRoleService.ScopedRoles::applicationRoles)
                .isEqualTo(Set.of("ROLE_SAFE"));
        assertThat(EffectiveRoleService.reaches(unnamedAuthority, incompleteClientRole)).isFalse();
    }

    @Test
    void handlesEmptyCompositeCollectionsAndIdentityMatches() {
        AuthorityEntity authority = authority(10L, "ROLE_EMPTY");
        authority.setCompositeRoles(null);
        authority.setCompositeClientRoles(null);
        ClientRoleEntity clientRole = clientRole(null, "client-role");
        clientRole.setCompositeRoles(null);
        clientRole.setCompositeRealmRoles(null);

        assertThat(EffectiveRoleService.reaches(authority, authority)).isTrue();
        assertThat(EffectiveRoleService.reaches(clientRole, clientRole)).isTrue();
        assertThat(EffectiveRoleService.reaches(authority, clientRole)).isFalse();
        assertThat(EffectiveRoleService.reaches(clientRole, authority)).isFalse();
    }

    private static GroupEntity group(Long id, String name, String role) {
        GroupEntity group = new GroupEntity();
        group.setId(id);
        group.setName(name);
        group.setAuthorities(Set.of(authority(id, role)));
        return group;
    }

    private static AuthorityEntity authority(Long id, String name) {
        return new AuthorityEntity(id, name);
    }

    private static ClientRoleEntity clientRole(RegisteredClientEntity client, String name) {
        return new ClientRoleEntity(client, name, null);
    }
}
