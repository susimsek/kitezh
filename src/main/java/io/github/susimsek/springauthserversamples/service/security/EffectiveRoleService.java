package io.github.susimsek.springauthserversamples.service.security;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/** Resolves direct, group-inherited, and effective roles consistently. */
public final class EffectiveRoleService {

    private EffectiveRoleService() {}

    public static EffectiveRoles resolve(UserEntity user) {
        Set<String> assigned = roleNames(user.getAuthorities());
        List<GroupRoleMapping> mappings = new ArrayList<>();
        Set<String> groupRoles = new LinkedHashSet<>();
        if (user.getGroups() != null) {
            user.getGroups().stream()
                    .sorted(Comparator.comparing(EffectiveRoleService::path))
                    .forEach(
                            group -> {
                                Set<String> roles = rolesForGroup(group);
                                groupRoles.addAll(roles);
                                mappings.add(
                                        new GroupRoleMapping(group.getId(), path(group), roles));
                            });
        }
        Set<String> inherited = new LinkedHashSet<>(groupRoles);
        inherited.removeAll(assigned);
        Set<String> effective = new LinkedHashSet<>(assigned);
        effective.addAll(groupRoles);
        return new EffectiveRoles(
                immutableSorted(assigned),
                List.copyOf(mappings),
                immutableSorted(inherited),
                immutableSorted(effective));
    }

    public static Set<String> effectiveRoleNames(UserEntity user) {
        return resolve(user).effectiveRoles();
    }

    public static Set<String> effectiveGroupRoleNames(GroupEntity group) {
        return rolesForGroup(group);
    }

    /** Resolves client roles assigned directly or inherited through the user's groups. */
    public static Map<String, Set<String>> effectiveClientRoleNames(UserEntity user) {
        Map<String, Set<String>> roles = new TreeMap<>();
        addClientRoles(roles, user.getClientRoles());
        if (user.getGroups() != null) {
            user.getGroups().forEach(group -> addClientRoles(roles, clientRolesForGroup(group)));
        }
        return roles.entrySet().stream()
                .collect(
                        java.util.stream.Collectors.toUnmodifiableMap(
                                Map.Entry::getKey,
                                entry -> Set.copyOf(new TreeSet<>(entry.getValue()))));
    }

    private static Set<ClientRoleEntity> clientRolesForGroup(GroupEntity group) {
        Set<ClientRoleEntity> roles = new LinkedHashSet<>();
        Set<GroupEntity> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        GroupEntity current = group;
        while (current != null && visited.add(current)) {
            if (current.getClientRoles() != null) {
                roles.addAll(current.getClientRoles());
            }
            current = current.getParent();
        }
        return roles;
    }

    private static void addClientRoles(
            Map<String, Set<String>> target, Set<ClientRoleEntity> clientRoles) {
        if (clientRoles == null) {
            return;
        }
        clientRoles.forEach(
                role -> {
                    if (role.getClient() != null && role.getClient().getClientId() != null) {
                        target.computeIfAbsent(
                                        role.getClient().getClientId(), ignored -> new TreeSet<>())
                                .add(role.getName());
                    }
                });
    }

    private static Set<String> rolesForGroup(GroupEntity group) {
        Set<String> roles = new LinkedHashSet<>();
        Set<GroupEntity> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        GroupEntity current = group;
        while (current != null && visited.add(current)) {
            roles.addAll(roleNames(current.getAuthorities()));
            current = current.getParent();
        }
        return immutableSorted(roles);
    }

    private static Set<String> roleNames(Set<AuthorityEntity> authorities) {
        if (authorities == null) {
            return Set.of();
        }
        return authorities.stream()
                .map(AuthorityEntity::getName)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<String> immutableSorted(Set<String> values) {
        return values.stream().sorted().collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private static String path(GroupEntity group) {
        List<String> names = new ArrayList<>();
        Set<GroupEntity> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        GroupEntity current = group;
        while (current != null && visited.add(current)) {
            names.add(current.getName());
            current = current.getParent();
        }
        Collections.reverse(names);
        return "/" + String.join("/", names);
    }

    public record GroupRoleMapping(Long groupId, String groupPath, Set<String> roles) {}

    public record EffectiveRoles(
            Set<String> assignedRoles,
            List<GroupRoleMapping> groupMappings,
            Set<String> inheritedRoles,
            Set<String> effectiveRoles) {}
}
