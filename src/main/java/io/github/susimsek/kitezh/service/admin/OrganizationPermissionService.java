package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationPermissionEntity;
import io.github.susimsek.kitezh.domain.OrganizationPermissionLevel;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationPermissionRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationPermissionRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrganizationPermissionService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationPermissionDTO> findAll(Long organizationId, Pageable pageable) {
        requireOrganization(organizationId);
        return permissionRepository.findByOrganizationId(organizationId, pageable).map(this::toDTO);
    }

    @Transactional
    public AdminOrganizationPermissionDTO upsert(
            Long organizationId, AdminOrganizationPermissionRequestDTO request) {
        OrganizationEntity organization = requireOrganization(organizationId);
        UserEntity user =
                userRepository
                        .findById(request.userId())
                        .orElseThrow(() -> ApiException.notFound("User not found"));
        OrganizationPermissionEntity permission =
                permissionRepository
                        .findByOrganizationIdAndUserId(organizationId, user.getId())
                        .orElseGet(OrganizationPermissionEntity::new);
        permission.setOrganization(organization);
        permission.setUser(user);
        permission.setPermissionLevel(request.permissionLevel());
        OrganizationPermissionEntity saved = permissionRepository.save(permission);
        auditEventService.record(
                "organization.permission.updated",
                "organization",
                organizationId.toString(),
                "userId=" + user.getId() + ",level=" + request.permissionLevel());
        return toDTO(saved);
    }

    public boolean canView(Long organizationId, String username) {
        return canAccess(organizationId, username, OrganizationPermissionLevel.VIEW);
    }

    public boolean canManage(Long organizationId, String username) {
        return canAccess(organizationId, username, OrganizationPermissionLevel.MANAGE);
    }

    private boolean canAccess(
            Long organizationId, String username, OrganizationPermissionLevel required) {
        if (username == null) {
            return false;
        }
        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return false;
        }
        OrganizationPermissionEntity permission =
                permissionRepository
                        .findByOrganizationIdAndUserId(organizationId, user.getId())
                        .orElse(null);
        return permission != null
                && (permission.getPermissionLevel() == OrganizationPermissionLevel.MANAGE
                        || permission.getPermissionLevel() == required);
    }

    private OrganizationEntity requireOrganization(Long id) {
        return organizationRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private AdminOrganizationPermissionDTO toDTO(OrganizationPermissionEntity entity) {
        return new AdminOrganizationPermissionDTO(
                entity.getId(),
                entity.getUser().getId(),
                entity.getUser().getUsername(),
                entity.getPermissionLevel());
    }
}
