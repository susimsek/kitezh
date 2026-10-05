package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.ClientRoleEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminClientRoleDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientRoleDetailDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientRoleGroupDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientRoleRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleUserDTO;
import io.github.susimsek.kitezh.mapper.AdminRoleMapper;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.ClientRoleRepository;
import io.github.susimsek.kitezh.repository.GroupRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.EffectiveRoleService;
import java.util.LinkedHashSet;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminClientRoleService {

    private static final String ROLE_TARGET = "client-role";

    private final ClientRepository clientRepository;
    private final ClientRoleRepository clientRoleRepository;
    private final AuthorityRepository authorityRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminRoleMapper adminRoleMapper;

    @Transactional(readOnly = true)
    public Page<AdminClientRoleDTO> findAll(String clientId, String query, Pageable pageable) {
        RegisteredClientEntity client = clientRequired(clientId);
        String normalizedQuery = AdminSearch.normalize(query);
        return clientRoleRepository
                .findByClientIdAndNameContainingIgnoreCase(clientId, normalizedQuery, pageable)
                .map(role -> toDTO(role, client.getClientId()));
    }

    @Transactional(readOnly = true)
    public AdminClientRoleDetailDTO findOne(
            String clientId, Long roleId, String query, Pageable pageable) {
        return findOneInternal(clientId, roleId, query, pageable);
    }

    private AdminClientRoleDetailDTO findOneInternal(
            String clientId, Long roleId, String query, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        String normalizedQuery = AdminSearch.normalize(query);
        Page<AdminRoleUserDTO> users =
                userRepository
                        .findByClientRolesIdAndUsernameContainingIgnoreCase(
                                roleId, normalizedQuery, pageable)
                        .map(adminRoleMapper::toUserDTO);
        Pageable groupPageable =
                org.springframework.data.domain.PageRequest.of(
                        pageable.getPageNumber(),
                        pageable.getPageSize(),
                        org.springframework.data.domain.Sort.by("name"));
        Page<AdminClientRoleGroupDTO> groups =
                groupRepository
                        .findByClientRolesIdAndNameContainingIgnoreCase(
                                roleId, normalizedQuery, groupPageable)
                        .map(
                                group ->
                                        new AdminClientRoleGroupDTO(
                                                group.getId(), group.getName(), groupPath(group)));
        return new AdminClientRoleDetailDTO(
                toDTO(role, role.getClient().getClientId()),
                users,
                groups,
                userRepository.countByClientRolesId(roleId),
                role.getGroups().size(),
                role.getCompositeRoles().stream()
                        .map(child -> toDTO(child, child.getClient().getClientId()))
                        .sorted(
                                java.util.Comparator.comparing(AdminClientRoleDTO::clientId)
                                        .thenComparing(AdminClientRoleDTO::name))
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)),
                role.getCompositeRealmRoles().stream()
                        .map(AdminClientRoleService::toRoleDTO)
                        .sorted(java.util.Comparator.comparing(AdminRoleDTO::name))
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
    }

    @Transactional(readOnly = true)
    public Page<AdminRoleUserDTO> availableUsers(
            String clientId, Long roleId, String query, Pageable pageable) {
        roleRequired(clientId, roleId);
        return userRepository
                .findAvailableClientRoleUsers(roleId, AdminSearch.normalize(query), pageable)
                .map(adminRoleMapper::toUserDTO);
    }

    @Transactional(readOnly = true)
    public Page<AdminClientRoleGroupDTO> availableGroups(
            String clientId, Long roleId, String query, Pageable pageable) {
        roleRequired(clientId, roleId);
        return groupRepository
                .findAvailableClientRoleGroups(roleId, AdminSearch.normalize(query), pageable)
                .map(
                        group ->
                                new AdminClientRoleGroupDTO(
                                        group.getId(), group.getName(), groupPath(group)));
    }

    @Transactional(readOnly = true)
    public Page<AdminClientRoleDTO> availableComposites(
            String clientId, Long roleId, String query, Pageable pageable) {
        roleRequired(clientId, roleId);
        return clientRoleRepository
                .findAvailableCompositeRoles(roleId, AdminSearch.normalize(query), pageable)
                .map(role -> toDTO(role, role.getClient().getClientId()));
    }

    @Transactional(readOnly = true)
    public Page<AdminRoleDTO> availableRealmComposites(
            String clientId, Long roleId, String query, Pageable pageable) {
        roleRequired(clientId, roleId);
        return clientRoleRepository
                .findAvailableRealmCompositeRoles(roleId, AdminSearch.normalize(query), pageable)
                .map(AdminClientRoleService::toRoleDTO);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO addComposite(
            String clientId, Long roleId, Long childRoleId, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        ClientRoleEntity child = clientRoleRequired(childRoleId);
        if (role.equals(child) || EffectiveRoleService.reaches(child, role)) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_ROLE_COMPOSITE_CYCLE,
                    "The client role composite relationship would create a cycle");
        }
        if (role.getCompositeRoles().add(child)) {
            child.getCompositeParents().add(role);
            invalidateAllUsers();
            adminAuditEventService.record(
                    "client-role.composite.added", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO removeComposite(
            String clientId, Long roleId, Long childRoleId, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        ClientRoleEntity child = clientRoleRequired(childRoleId);
        if (role.getCompositeRoles().remove(child)) {
            child.getCompositeParents().remove(role);
            invalidateAllUsers();
            adminAuditEventService.record(
                    "client-role.composite.removed", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO addRealmComposite(
            String clientId, Long roleId, String childName, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        AuthorityEntity child =
                authorityRepository
                        .findByName(childName)
                        .orElseThrow(() -> ApiException.notFound("Role not found"));
        if (EffectiveRoleService.reaches(child, role)) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_ROLE_COMPOSITE_CYCLE,
                    "The client role composite relationship would create a cycle");
        }
        if (role.getCompositeRealmRoles().add(child)) {
            invalidateAllUsers();
            adminAuditEventService.record(
                    "client-role.composite-realm.added", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO removeRealmComposite(
            String clientId, Long roleId, String childName, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        AuthorityEntity child =
                authorityRepository
                        .findByName(childName)
                        .orElseThrow(() -> ApiException.notFound("Role not found"));
        if (role.getCompositeRealmRoles().remove(child)) {
            invalidateAllUsers();
            adminAuditEventService.record(
                    "client-role.composite-realm.removed", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    @Transactional
    public AdminClientRoleDTO create(String clientId, AdminClientRoleRequestDTO request) {
        RegisteredClientEntity client = clientRequired(clientId);
        String name = normalizeName(request.name());
        if (clientRoleRepository.existsByClientIdAndName(clientId, name)) {
            throw ApiException.conflict(
                    "name", ApiErrorCode.CLIENT_ROLE_DUPLICATE_NAME, "Client role already exists");
        }
        ClientRoleEntity role =
                clientRoleRepository.save(
                        new ClientRoleEntity(
                                client, name, normalizeDescription(request.description())));
        adminAuditEventService.record("client-role.created", ROLE_TARGET, role.getId().toString());
        return toDTO(role, client.getClientId());
    }

    @Transactional
    public AdminClientRoleDTO update(
            String clientId, Long roleId, AdminClientRoleRequestDTO request) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        String name = normalizeName(request.name());
        if (!role.getName().equals(name)
                && clientRoleRepository.existsByClientIdAndName(clientId, name)) {
            throw ApiException.conflict(
                    "name", ApiErrorCode.CLIENT_ROLE_DUPLICATE_NAME, "Client role already exists");
        }
        role.setName(name);
        role.setDescription(normalizeDescription(request.description()));
        adminAuditEventService.record("client-role.updated", ROLE_TARGET, roleId.toString());
        return toDTO(role, role.getClient().getClientId());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void delete(String clientId, Long roleId) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        if (!role.getUsers().isEmpty() || !role.getGroups().isEmpty()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_ROLE_ASSIGNED,
                    "Client role is assigned to one or more users or groups");
        }
        clientRoleRepository.delete(role);
        invalidateAllUsers();
        adminAuditEventService.record("client-role.deleted", ROLE_TARGET, roleId.toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO assignUser(
            String clientId, Long roleId, Long userId, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        UserEntity user = userRequired(userId);
        if (user.getClientRoles().add(role)) {
            userAccessInvalidationService.invalidateForCurrentPrincipal(user.getUsername());
            adminAuditEventService.record(
                    "client-role.user.assigned", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO removeUser(
            String clientId, Long roleId, Long userId, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        UserEntity user = userRequired(userId);
        if (user.getClientRoles().remove(role)) {
            userAccessInvalidationService.invalidateForCurrentPrincipal(user.getUsername());
            adminAuditEventService.record(
                    "client-role.user.removed", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO assignGroup(
            String clientId, Long roleId, Long groupId, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        GroupEntity group = groupRequired(groupId);
        if (group.getClientRoles().add(role)) {
            role.getGroups().add(group);
            invalidateGroupUsers(group);
            adminAuditEventService.record(
                    "client-role.group.assigned", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public AdminClientRoleDetailDTO removeGroup(
            String clientId, Long roleId, Long groupId, Pageable pageable) {
        ClientRoleEntity role = roleRequired(clientId, roleId);
        GroupEntity group = groupRequired(groupId);
        if (group.getClientRoles().remove(role)) {
            role.getGroups().remove(group);
            invalidateGroupUsers(group);
            adminAuditEventService.record(
                    "client-role.group.removed", ROLE_TARGET, roleId.toString());
        }
        return findOneInternal(clientId, roleId, "", pageable);
    }

    private RegisteredClientEntity clientRequired(String clientId) {
        return clientRepository
                .findById(clientId)
                .orElseThrow(() -> ApiException.notFound("Client not found"));
    }

    private ClientRoleEntity roleRequired(String clientId, Long roleId) {
        ClientRoleEntity role = clientRoleRequired(roleId);
        if (!role.getClient().getId().equals(clientId)) {
            throw ApiException.notFound("Client role not found");
        }
        return role;
    }

    private ClientRoleEntity clientRoleRequired(Long roleId) {
        return clientRoleRepository
                .findDetailedById(roleId)
                .orElseThrow(() -> ApiException.notFound("Client role not found"));
    }

    private UserEntity userRequired(Long userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private GroupEntity groupRequired(Long groupId) {
        return groupRepository
                .findById(groupId)
                .orElseThrow(() -> ApiException.notFound("Group not found"));
    }

    private void invalidateGroupUsers(GroupEntity group) {
        userRepository.findAllByGroupsId(group.getId()).stream()
                .map(UserEntity::getUsername)
                .forEach(userAccessInvalidationService::invalidateForCurrentPrincipal);
    }

    private void invalidateAllUsers() {
        userRepository.findAll().stream()
                .map(UserEntity::getUsername)
                .forEach(userAccessInvalidationService::invalidate);
    }

    private static AdminClientRoleDTO toDTO(ClientRoleEntity role, String clientId) {
        return new AdminClientRoleDTO(
                role.getId(), clientId, role.getName(), role.getDescription());
    }

    private static AdminRoleDTO toRoleDTO(AuthorityEntity role) {
        return new AdminRoleDTO(role.getName(), role.getDescription());
    }

    private static String groupPath(GroupEntity group) {
        java.util.Deque<String> names = new java.util.ArrayDeque<>();
        GroupEntity current = group;
        while (current != null) {
            names.addFirst(current.getName());
            current = current.getParent();
        }
        return String.join(" / ", names);
    }

    private static String normalizeName(String value) {
        String name = value == null ? "" : value.strip();
        if (name.isEmpty() || !name.matches("[A-Za-z0-9._:-]+")) {
            throw ApiException.badRequest(
                    "name", ApiErrorCode.CLIENT_ROLE_INVALID_NAME, "Client role name is invalid");
        }
        return name;
    }

    private static String normalizeDescription(String value) {
        if (value == null) {
            return null;
        }
        String description = value.strip();
        return description.isEmpty() ? null : description;
    }
}
