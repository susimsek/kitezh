package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.dto.admin.AdminConsentDTO;
import java.util.Map;
import java.util.stream.Collectors;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminConsentMapper {

    default AdminConsentDTO toDTO(
            AuthorizationConsentEntity consent,
            Map<String, String> clientNames,
            Map<String, Long> userIds,
            AuthorizationServerMapperSupport support) {
        String clientId = consent.getId().getRegisteredClientId();
        String username = consent.getId().getPrincipalName();
        return new AdminConsentDTO(
                clientId,
                clientNames.getOrDefault(clientId, clientId),
                username,
                userIds.get(username),
                support.readAuthorities(consent.getAuthorities()).stream()
                        .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                        .collect(Collectors.toUnmodifiableSet()),
                consent.getCreatedAt(),
                consent.getUpdatedAt());
    }
}
