package io.github.susimsek.kitezh.service.security;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.ClientRoleEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
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
        Set<String> assignedEffective =
                expandRoles(user.getAuthorities(), user.getClientRoles()).realmRoles();
        Set<String> inherited = new LinkedHashSet<>(groupRoles);
        inherited.removeAll(assignedEffective);
        Set<String> effective = new LinkedHashSet<>(assignedEffective);
        effective.addAll(groupRoles);
        Set<String> assigned = roleNames(user.getAuthorities());
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
        addExpandedRoles(roles, expandRoles(user.getAuthorities(), user.getClientRoles()));
        if (user.getGroups() != null) {
            user.getGroups().forEach(group -> addGroupClientRoles(roles, group));
        }
        return roles.entrySet().stream()
                .collect(
                        java.util.stream.Collectors.toUnmodifiableMap(
                                Map.Entry::getKey,
                                entry -> Set.copyOf(new TreeSet<>(entry.getValue()))));
    }

    /** Expands role composites configured on a client scope. */
    public static ScopedRoles expandScopeRoles(
            Set<AuthorityEntity> applicationRoles, Set<ClientRoleEntity> clientRoles) {
        ExpandedRoles expanded =
                expandRoles(
                        applicationRoles == null ? Set.of() : applicationRoles,
                        clientRoles == null ? Set.of() : clientRoles);
        return new ScopedRoles(
                immutableSorted(expanded.realmRoles()),
                expanded.clientRoles().entrySet().stream()
                        .collect(
                                java.util.stream.Collectors.toUnmodifiableMap(
                                        Map.Entry::getKey,
                                        entry -> Set.copyOf(new TreeSet<>(entry.getValue())))));
    }

    private static void addGroupClientRoles(Map<String, Set<String>> target, GroupEntity group) {
        Set<GroupEntity> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        GroupEntity current = group;
        while (current != null && visited.add(current)) {
            addExpandedRoles(
                    target, expandRoles(current.getAuthorities(), current.getClientRoles()));
            current = current.getParent();
        }
    }

    private static void addExpandedRoles(Map<String, Set<String>> target, ExpandedRoles expanded) {
        expanded.clientRoles()
                .forEach(
                        (clientId, names) ->
                                target.computeIfAbsent(clientId, ignored -> new TreeSet<>())
                                        .addAll(names));
    }

    private static Set<String> rolesForGroup(GroupEntity group) {
        Set<String> roles = new LinkedHashSet<>();
        Set<GroupEntity> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        GroupEntity current = group;
        while (current != null && visited.add(current)) {
            roles.addAll(
                    expandRoles(current.getAuthorities(), current.getClientRoles()).realmRoles());
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

    private static ExpandedRoles expandRoles(
            Set<AuthorityEntity> authorities, Set<ClientRoleEntity> clientRoles) {
        Set<String> realmRoles = new LinkedHashSet<>();
        Map<String, Set<String>> effectiveClientRoles = new TreeMap<>();
        Set<Object> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        if (authorities != null) {
            authorities.forEach(
                    role -> addAuthorityRole(role, realmRoles, effectiveClientRoles, visited));
        }
        if (clientRoles != null) {
            clientRoles.forEach(
                    role -> addClientRole(role, realmRoles, effectiveClientRoles, visited));
        }
        return new ExpandedRoles(realmRoles, effectiveClientRoles);
    }

    private static void addAuthorityRole(
            AuthorityEntity role,
            Set<String> realmRoles,
            Map<String, Set<String>> clientRoles,
            Set<Object> visited) {
        if (role == null || !visited.add(role)) {
            return;
        }
        if (role.getName() != null) {
            realmRoles.add(role.getName());
        }
        if (role.getCompositeRoles() != null) {
            role.getCompositeRoles()
                    .forEach(child -> addAuthorityRole(child, realmRoles, clientRoles, visited));
        }
        if (role.getCompositeClientRoles() != null) {
            role.getCompositeClientRoles()
                    .forEach(child -> addClientRole(child, realmRoles, clientRoles, visited));
        }
    }

    private static void addClientRole(
            ClientRoleEntity role,
            Set<String> realmRoles,
            Map<String, Set<String>> clientRoles,
            Set<Object> visited) {
        if (role == null || !visited.add(role)) {
            return;
        }
        if (role.getClient() != null
                && role.getClient().getClientId() != null
                && role.getName() != null) {
            clientRoles
                    .computeIfAbsent(role.getClient().getClientId(), ignored -> new TreeSet<>())
                    .add(role.getName());
        }
        if (role.getCompositeRoles() != null) {
            role.getCompositeRoles()
                    .forEach(child -> addClientRole(child, realmRoles, clientRoles, visited));
        }
        if (role.getCompositeRealmRoles() != null) {
            role.getCompositeRealmRoles()
                    .forEach(child -> addAuthorityRole(child, realmRoles, clientRoles, visited));
        }
    }

    public static boolean reaches(AuthorityEntity start, AuthorityEntity target) {
        return reachesRole(start, target, Collections.newSetFromMap(new IdentityHashMap<>()));
    }

    public static boolean reaches(AuthorityEntity start, ClientRoleEntity target) {
        return reachesRole(start, target, Collections.newSetFromMap(new IdentityHashMap<>()));
    }

    public static boolean reaches(ClientRoleEntity start, AuthorityEntity target) {
        return reachesRole(start, target, Collections.newSetFromMap(new IdentityHashMap<>()));
    }

    public static boolean reaches(ClientRoleEntity start, ClientRoleEntity target) {
        return reachesRole(start, target, Collections.newSetFromMap(new IdentityHashMap<>()));
    }

    private static boolean reachesRole(Object current, Object target, Set<Object> visited) {
        if (current == null || target == null || !visited.add(current)) {
            return false;
        }
        if (current.equals(target)) {
            return true;
        }
        if (current instanceof AuthorityEntity authority) {
            return (authority.getCompositeRoles() != null
                            && authority.getCompositeRoles().stream()
                                    .anyMatch(child -> reachesRole(child, target, visited)))
                    || (authority.getCompositeClientRoles() != null
                            && authority.getCompositeClientRoles().stream()
                                    .anyMatch(child -> reachesRole(child, target, visited)));
        }
        ClientRoleEntity clientRole = (ClientRoleEntity) current;
        return (clientRole.getCompositeRoles() != null
                        && clientRole.getCompositeRoles().stream()
                                .anyMatch(child -> reachesRole(child, target, visited)))
                || (clientRole.getCompositeRealmRoles() != null
                        && clientRole.getCompositeRealmRoles().stream()
                                .anyMatch(child -> reachesRole(child, target, visited)));
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

    private record ExpandedRoles(Set<String> realmRoles, Map<String, Set<String>> clientRoles) {}

    public record EffectiveRoles(
            Set<String> assignedRoles,
            List<GroupRoleMapping> groupMappings,
            Set<String> inheritedRoles,
            Set<String> effectiveRoles) {}

    public record ScopedRoles(Set<String> applicationRoles, Map<String, Set<String>> clientRoles) {}
}
