package io.github.susimsek.springauthserversamples.service.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
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
