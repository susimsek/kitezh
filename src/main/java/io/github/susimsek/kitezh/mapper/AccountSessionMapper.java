package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import io.github.susimsek.kitezh.domain.UserSessionEntity;
import io.github.susimsek.kitezh.dto.account.AccountSessionClientDTO;
import io.github.susimsek.kitezh.dto.account.AccountSessionDTO;
import io.github.susimsek.kitezh.security.OidcSessionIdentifier;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AccountSessionMapper {

    default AccountSessionDTO toDTO(
            UserSessionEntity session,
            String currentSessionId,
            List<AuthorizationEntity> authorizations,
            Map<String, String> clientNames) {
        List<AccountSessionClientDTO> clients =
                authorizations.stream()
                        .map(AuthorizationEntity::getRegisteredClientId)
                        .distinct()
                        .map(
                                clientId ->
                                        new AccountSessionClientDTO(
                                                clientId,
                                                clientNames.getOrDefault(clientId, clientId)))
                        .toList();
        return new AccountSessionDTO(
                session.getSessionId(),
                Instant.ofEpochMilli(session.getCreationTime()),
                Instant.ofEpochMilli(session.getLastAccessTime()),
                Instant.ofEpochMilli(session.getExpiryTime()),
                OidcSessionIdentifier.matches(currentSessionId, session.getSessionId()),
                clients);
    }
}
