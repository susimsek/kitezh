package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.dto.account.AccountApplicationDTO;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AccountApplicationMapper {

    default AccountApplicationDTO toDTO(
            AuthorizationConsentEntity consent,
            Map<String, String> clientNames,
            AuthorizationServerMapperSupport support) {
        String clientId = consent.getId().getRegisteredClientId();
        Set<String> scopes =
                support.readAuthorities(consent.getAuthorities()).stream()
                        .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                        .collect(Collectors.toUnmodifiableSet());
        return new AccountApplicationDTO(
                clientId,
                clientNames.getOrDefault(clientId, clientId),
                scopes,
                consent.getCreatedAt(),
                consent.getUpdatedAt());
    }
}
