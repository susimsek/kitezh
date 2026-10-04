package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.UserSessionEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDetailDTO;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminSessionMapper {

    default AdminSessionDTO toDTO(UserSessionEntity session, Map<String, Long> counts) {
        return new AdminSessionDTO(
                session.getSessionId(),
                session.getPrincipalName(),
                java.time.Instant.ofEpochMilli(session.getCreationTime()),
                java.time.Instant.ofEpochMilli(session.getLastAccessTime()),
                java.time.Instant.ofEpochMilli(session.getExpiryTime()),
                counts.getOrDefault(session.getSessionId(), 0L),
                session.getExpiryTime() > System.currentTimeMillis());
    }

    default AdminAuthorizationDTO toAuthorizationDTO(
            AuthorizationEntity authorization, RegisteredClientEntity client) {
        String clientId =
                client == null ? authorization.getRegisteredClientId() : client.getClientId();
        String clientName =
                client == null ? authorization.getRegisteredClientId() : client.getClientName();
        return new AdminAuthorizationDTO(
                authorization.getId(),
                clientId,
                clientName,
                authorization.getAuthorizationGrantType(),
                splitScopes(authorization.getAuthorizedScopes()),
                authorization.getAccessTokenIssuedAt(),
                authorization.getAccessTokenExpiresAt(),
                authorization.getRefreshTokenExpiresAt());
    }

    default AdminSessionDetailDTO toDetailDTO(
            UserSessionEntity session,
            Map<String, Long> counts,
            List<AdminAuthorizationDTO> authorizations) {
        return new AdminSessionDetailDTO(toDTO(session, counts), authorizations);
    }

    default List<String> splitScopes(String scopes) {
        if (scopes == null || scopes.isBlank()) {
            return List.of();
        }
        return Arrays.stream(scopes.split("[, ]+"))
                .filter(scope -> !scope.isBlank())
                .distinct()
                .toList();
    }
}
