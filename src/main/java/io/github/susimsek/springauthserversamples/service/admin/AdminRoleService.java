package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRoleDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleDetailDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminRoleUserDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminRoleMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRoleRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminRoleService {

    private static final String ROLE_NOT_FOUND = "Role not found";
    private static final String CLIENT_ROLE_NOT_FOUND = "Client role not found";

    private final AuthorityRepository authorityRepository;
    private final ClientRoleRepository clientRoleRepository;
    private final UserRepository userRepository;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminUserService adminUserService;
    private final AdminRoleMapper adminRoleMapper;
    private final UserAccessInvalidationService userAccessInvalidationService;

    public AdminRoleService(
            AuthorityRepository authorityRepository,
            UserRepository userRepository,
            AdminAuditEventService adminAuditEventService,
            AdminUserService adminUserService) {
        this(
                null,
                authorityRepository,
                userRepository,
                adminAuditEventService,
                adminUserService,
                null,
                null);
    }

    @Autowired
    public AdminRoleService(
            ClientRoleRepository clientRoleRepository,
            AuthorityRepository authorityRepository,
            UserRepository userRepository,
            AdminAuditEventService adminAuditEventService,
            AdminUserService adminUserService,
            AdminRoleMapper adminRoleMapper,
            UserAccessInvalidationService userAccessInvalidationService) {
        this.authorityRepository = authorityRepository;
        this.clientRoleRepository = clientRoleRepository;
        this.userRepository = userRepository;
        this.adminAuditEventService = adminAuditEventService;
        this.adminUserService = adminUserService;
        this.adminRoleMapper = adminRoleMapper;
        this.userAccessInvalidationService = userAccessInvalidationService;
    }

    @Transactional(readOnly = true)
    public Page<AdminRoleDTO> roles(String query, Pageable pageable) {
        return authorityRepository
                .findByNameContainingIgnoreCase(AdminSearch.normalize(query), pageable)
                .map(adminRoleMapper::toDTO);
    }

    @Transactional(readOnly = true)
    public Page<AdminRoleUserDTO> availableUsers(String name, String query, Pageable pageable) {
        if (!authorityRepository.existsByName(name)) {
            throw ApiException.notFound(ROLE_NOT_FOUND);
        }
        String normalizedQuery = AdminSearch.normalize(query);
        java.util.List<UserEntity> allUsers = userRepository.findAllWithEffectiveAuthorities();
        if (allUsers != null && !allUsers.isEmpty()) {
            java.util.List<UserEntity> availableUsers =
                    allUsers.stream()
                            .filter(UserEntity::isEnabled)
                            .filter(
                                    user ->
                                            !EffectiveRoleService.effectiveRoleNames(user)
                                                    .contains(name))
                            .filter(user -> matchesQuery(user, normalizedQuery))
                            .toList();
            availableUsers = sortUsers(availableUsers, pageable);
            int start = (int) Math.min(pageable.getOffset(), availableUsers.size());
            int end = Math.min(start + pageable.getPageSize(), availableUsers.size());
            return new PageImpl<>(
                    availableUsers.subList(start, end).stream()
                            .map(adminRoleMapper::toUserDTO)
                            .toList(),
                    pageable,
                    availableUsers.size());
        }
        return userRepository
                .findAvailableRoleUsers(name, normalizedQuery, pageable)
                .map(adminRoleMapper::toUserDTO);
    }

    @Transactional(readOnly = true)
    public Page<AdminRoleDTO> availableComposites(String name, String query, Pageable pageable) {
        roleRequired(name);
        return authorityRepository
                .findAvailableCompositeRoles(name, AdminSearch.normalize(query), pageable)
                .map(adminRoleMapper::toDTO);
    }

    @Transactional(readOnly = true)
    public Page<AdminClientRoleDTO> availableClientComposites(
            String name, String query, Pageable pageable) {
        roleRequired(name);
        if (clientRoleRepository == null) {
            return Page.empty(pageable);
        }
        return clientRoleRepository
                .findAvailableClientRolesForAuthorityComposite(
                        name, AdminSearch.normalize(query), pageable)
                .map(AdminRoleService::toClientRoleDTO);
    }

    @Transactional(readOnly = true)
    public AdminRoleDetailDTO role(String name, String query, Pageable pageable) {
        return roleInternal(name, query, null, pageable);
    }

    @Transactional(readOnly = true)
    public AdminRoleDetailDTO role(String name, String query, Boolean enabled, Pageable pageable) {
        return roleInternal(name, query, enabled, pageable);
    }

    @Transactional(readOnly = true)
    public AdminRoleDetailDTO role(String name, Pageable pageable) {
        return roleInternal(name, "", null, pageable);
    }

    private AdminRoleDetailDTO roleInternal(
            String name, String query, Boolean enabled, Pageable pageable) {
        final AuthorityEntity role =
                authorityRepository
                        .findByName(name)
                        .orElseThrow(() -> ApiException.notFound(ROLE_NOT_FOUND));
        return roleInternal(role, query, enabled, pageable);
    }

    private AdminRoleDetailDTO roleInternal(
            AuthorityEntity role, String query, Boolean enabled, Pageable pageable) {
        String normalizedQuery = AdminSearch.normalize(query);
        java.util.List<UserEntity> allUsers = userRepository.findAllWithEffectiveAuthorities();
        boolean loadedAllUsers = allUsers != null && !allUsers.isEmpty();
        if (allUsers == null) {
            allUsers = java.util.List.of();
        }
        java.util.List<UserEntity> effectiveUsers =
                allUsers.stream()
                        .filter(
                                user ->
                                        EffectiveRoleService.effectiveRoleNames(user)
                                                .contains(role.getName()))
                        .filter(user -> enabled == null || user.isEnabled() == enabled)
                        .filter(user -> matchesQuery(user, normalizedQuery))
                        .toList();
        effectiveUsers = sortUsers(effectiveUsers, pageable);
        Page<AdminRoleUserDTO> users;
        if (!loadedAllUsers) {
            users =
                    userRepository
                            .findByAuthoritiesNameAndUsernameContainingIgnoreCase(
                                    role.getName(), normalizedQuery, pageable)
                            .map(adminRoleMapper::toUserDTO);
        } else {
            int start = (int) Math.min(pageable.getOffset(), effectiveUsers.size());
            int end = Math.min(start + pageable.getPageSize(), effectiveUsers.size());
            users =
                    new PageImpl<>(
                            effectiveUsers.subList(start, end).stream()
                                    .map(adminRoleMapper::toUserDTO)
                                    .toList(),
                            pageable,
                            effectiveUsers.size());
        }
        long userCount =
                !loadedAllUsers
                        ? userRepository.countByAuthoritiesId(role.getId())
                        : effectiveUsers.size();
        return adminRoleMapper.toDetailDTO(
                role.getName(),
                role.getDescription(),
                userCount,
                AuthoritiesConstants.ADMIN.equals(role.getName())
                        || AuthoritiesConstants.USER.equals(role.getName()),
                users,
                role.getCompositeRoles().stream()
                        .map(AuthorityEntity::getName)
                        .sorted()
                        .collect(
                                java.util.stream.Collectors.toCollection(
                                        java.util.LinkedHashSet::new)),
                role.getCompositeClientRoles().stream()
                        .map(AdminRoleService::toClientRoleDTO)
                        .sorted(
                                java.util.Comparator.comparing(AdminClientRoleDTO::clientId)
                                        .thenComparing(AdminClientRoleDTO::name))
                        .collect(
                                java.util.stream.Collectors.toCollection(
                                        java.util.LinkedHashSet::new)));
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                AuthorityRepository.AUTHORITY_BY_NAME_CACHE,
                UserRepository.USER_BY_USERNAME_CACHE
            },
            allEntries = true)
    public AdminRoleDetailDTO addComposite(String name, String childName, Pageable pageable) {
        List<AuthorityEntity> roles = authorityRepository.findAllWithCompositeRoles();
        AuthorityEntity role = roleRequired(roles, name);
        AuthorityEntity child = roleRequired(roles, childName);
        if (role.equals(child) || EffectiveRoleService.reaches(child, role)) {
            throw ApiException.badRequest(
                    ApiErrorCode.ROLE_COMPOSITE_CYCLE,
                    "The role composite relationship would create a cycle");
        }
        if (role.getCompositeRoles().add(child)) {
            child.getCompositeParents().add(role);
            invalidateAllUsers();
            adminAuditEventService.record("role.composite.added", "role", name);
        }
        return roleInternal(role, "", null, pageable);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                AuthorityRepository.AUTHORITY_BY_NAME_CACHE,
                UserRepository.USER_BY_USERNAME_CACHE
            },
            allEntries = true)
    public AdminRoleDetailDTO removeComposite(String name, String childName, Pageable pageable) {
        AuthorityEntity role = roleRequired(name);
        AuthorityEntity child = roleRequired(childName);
        if (role.getCompositeRoles().remove(child)) {
            child.getCompositeParents().remove(role);
            invalidateAllUsers();
            adminAuditEventService.record("role.composite.removed", "role", name);
        }
        return roleInternal(role, "", null, pageable);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                AuthorityRepository.AUTHORITY_BY_NAME_CACHE,
                UserRepository.USER_BY_USERNAME_CACHE
            },
            allEntries = true)
    public AdminRoleDetailDTO addClientComposite(String name, Long childRoleId, Pageable pageable) {
        AuthorityEntity role = roleRequired(name);
        if (clientRoleRepository == null) {
            throw ApiException.notFound(CLIENT_ROLE_NOT_FOUND);
        }
        ClientRoleEntity child =
                clientRoleRepository
                        .findDetailedById(childRoleId)
                        .orElseThrow(() -> ApiException.notFound(CLIENT_ROLE_NOT_FOUND));
        if (EffectiveRoleService.reaches(child, role)) {
            throw ApiException.badRequest(
                    ApiErrorCode.ROLE_COMPOSITE_CYCLE,
                    "The role composite relationship would create a cycle");
        }
        if (role.getCompositeClientRoles().add(child)) {
            invalidateAllUsers();
            adminAuditEventService.record("role.composite-client.added", "role", name);
        }
        return roleInternal(role, "", null, pageable);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                AuthorityRepository.AUTHORITY_BY_NAME_CACHE,
                UserRepository.USER_BY_USERNAME_CACHE
            },
            allEntries = true)
    public AdminRoleDetailDTO removeClientComposite(
            String name, Long childRoleId, Pageable pageable) {
        AuthorityEntity role = roleRequired(name);
        if (clientRoleRepository == null) {
            throw ApiException.notFound(CLIENT_ROLE_NOT_FOUND);
        }
        ClientRoleEntity child =
                clientRoleRepository
                        .findDetailedById(childRoleId)
                        .orElseThrow(() -> ApiException.notFound(CLIENT_ROLE_NOT_FOUND));
        if (role.getCompositeClientRoles().remove(child)) {
            invalidateAllUsers();
            adminAuditEventService.record("role.composite-client.removed", "role", name);
        }
        return roleInternal(role, "", null, pageable);
    }

    @Transactional
    public AdminRoleDetailDTO assignUser(
            String name, Long userId, String currentUsername, Pageable pageable) {
        adminUserService.assignRole(userId, name, currentUsername);
        adminAuditEventService.record("role.user.assigned", "role", name);
        return roleInternal(name, "", null, pageable);
    }

    @Transactional
    public AdminRoleDetailDTO removeUser(
            String name, Long userId, String currentUsername, Pageable pageable) {
        adminUserService.removeRole(userId, name, currentUsername);
        adminAuditEventService.record("role.user.removed", "role", name);
        return roleInternal(name, "", null, pageable);
    }

    @Transactional
    @CacheEvict(cacheNames = AuthorityRepository.AUTHORITY_BY_NAME_CACHE, allEntries = true)
    public AdminRoleDTO createRole(String name) {
        return createRoleInternal(name, null);
    }

    @Transactional
    @CacheEvict(cacheNames = AuthorityRepository.AUTHORITY_BY_NAME_CACHE, allEntries = true)
    public AdminRoleDTO createRole(String name, String description) {
        return createRoleInternal(name, description);
    }

    private AdminRoleDTO createRoleInternal(String name, String description) {
        validateRoleName(name);
        if (authorityRepository.existsByName(name)) {
            throw ApiException.conflict(
                    "name", ApiErrorCode.ROLE_DUPLICATE_NAME, "Role is already registered");
        }
        AdminRoleDTO view =
                adminRoleMapper.toDTO(
                        authorityRepository.save(
                                adminRoleMapper.toEntity(name, normalizeDescription(description))));
        adminAuditEventService.record("role.created", "role", name);
        return view;
    }

    @Transactional
    @CacheEvict(cacheNames = AuthorityRepository.AUTHORITY_BY_NAME_CACHE, allEntries = true)
    public AdminRoleDTO updateRole(String name, String description) {
        AuthorityEntity role =
                authorityRepository
                        .findByName(name)
                        .orElseThrow(() -> ApiException.notFound(ROLE_NOT_FOUND));
        role.setDescription(normalizeDescription(description));
        adminAuditEventService.record("role.updated", "role", name);
        return adminRoleMapper.toDTO(role);
    }

    @Transactional
    @CacheEvict(cacheNames = AuthorityRepository.AUTHORITY_BY_NAME_CACHE, allEntries = true)
    public void deleteRole(String name) {
        AuthorityEntity role =
                authorityRepository
                        .findByName(name)
                        .orElseThrow(() -> ApiException.notFound(ROLE_NOT_FOUND));
        if (AuthoritiesConstants.ADMIN.equals(name) || AuthoritiesConstants.USER.equals(name)) {
            throw ApiException.badRequest(ApiErrorCode.ROLE_PROTECTED, "Role cannot be removed");
        }
        if (userRepository.countByAuthoritiesId(role.getId()) > 0) {
            throw ApiException.badRequest(
                    ApiErrorCode.ROLE_ASSIGNED, "Role is assigned to one or more users");
        }
        authorityRepository.delete(role);
        invalidateAllUsers();
        adminAuditEventService.record("role.deleted", "role", name);
    }

    private static void validateRoleName(String name) {
        if (name == null || !name.matches("ROLE_[A-Z0-9_]+")) {
            throw ApiException.badRequest(
                    "name",
                    ApiErrorCode.ROLE_INVALID_NAME,
                    "Role names must use ROLE_ uppercase format");
        }
    }

    private static String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String value = description.strip();
        return value.isEmpty() ? null : value;
    }

    private AuthorityEntity roleRequired(String name) {
        return authorityRepository
                .findByName(name)
                .orElseThrow(() -> ApiException.notFound(ROLE_NOT_FOUND));
    }

    private AuthorityEntity roleRequired(List<AuthorityEntity> roles, String name) {
        return roles.stream()
                .filter(role -> name.equals(role.getName()))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound(ROLE_NOT_FOUND));
    }

    private static AdminClientRoleDTO toClientRoleDTO(ClientRoleEntity role) {
        return new AdminClientRoleDTO(
                role.getId(),
                role.getClient().getClientId(),
                role.getName(),
                role.getDescription());
    }

    private void invalidateAllUsers() {
        if (userAccessInvalidationService == null) {
            return;
        }
        userRepository.findAll().stream()
                .map(UserEntity::getUsername)
                .forEach(userAccessInvalidationService::invalidate);
    }

    private static boolean matchesQuery(UserEntity user, String query) {
        if (query.isEmpty()) {
            return true;
        }
        String normalized = query.toLowerCase(java.util.Locale.ROOT);
        return contains(user.getUsername(), normalized)
                || contains(user.getEmail(), normalized)
                || contains(user.getFirstName(), normalized)
                || contains(user.getLastName(), normalized);
    }

    private static boolean contains(String value, String query) {
        return value != null && value.toLowerCase(java.util.Locale.ROOT).contains(query);
    }

    private static java.util.List<UserEntity> sortUsers(
            java.util.List<UserEntity> users, Pageable pageable) {
        java.util.Comparator<UserEntity> comparator = null;
        for (Sort.Order order : pageable.getSort()) {
            java.util.Comparator<UserEntity> next =
                    java.util.Comparator.comparing(
                            user -> sortValue(user, order.getProperty()),
                            java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            if (order.isDescending()) {
                next = next.reversed();
            }
            comparator = comparator == null ? next : comparator.thenComparing(next);
        }
        if (comparator == null) {
            comparator =
                    java.util.Comparator.comparing(
                            UserEntity::getUsername,
                            java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
        }
        return users.stream().sorted(comparator.thenComparing(UserEntity::getId)).toList();
    }

    private static String sortValue(UserEntity user, String property) {
        return switch (property) {
            case "email" -> user.getEmail();
            case "firstName" -> user.getFirstName();
            case "lastName" -> user.getLastName();
            case "enabled" -> Boolean.toString(user.isEnabled());
            default -> user.getUsername();
        };
    }
}
