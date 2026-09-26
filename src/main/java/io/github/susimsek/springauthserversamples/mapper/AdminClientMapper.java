package io.github.susimsek.springauthserversamples.mapper;

import io.github.susimsek.springauthserversamples.dto.admin.AdminClientCreatedDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientDTO;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import java.util.stream.Collectors;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminClientMapper {

    default AdminClientDTO toDTO(RegisteredClient client) {
        return new AdminClientDTO(
                client.getId(),
                client.getClientId(),
                client.getClientName(),
                client.getClientIdIssuedAt(),
                client.getClientSecretExpiresAt(),
                client.getClientAuthenticationMethods().stream()
                        .map(ClientAuthenticationMethod::getValue)
                        .collect(Collectors.toUnmodifiableSet()),
                client.getAuthorizationGrantTypes().stream()
                        .map(AuthorizationGrantType::getValue)
                        .collect(Collectors.toUnmodifiableSet()),
                client.getRedirectUris(),
                client.getPostLogoutRedirectUris(),
                client.getScopes(),
                client.getClientSettings().isRequireAuthorizationConsent(),
                client.getClientSettings().isRequireProofKey(),
                ClientSecuritySettings.requiresDpopProof(client),
                ClientSecuritySettings.requiresDpopJkt(client),
                ClientSecuritySettings.requiresDpopForRefreshToken(client),
                ClientSecuritySettings.allowedDpopSigningAlgorithms(client),
                client.getTokenSettings().getAuthorizationCodeTimeToLive(),
                client.getTokenSettings().getAccessTokenTimeToLive(),
                client.getTokenSettings().getRefreshTokenTimeToLive());
    }

    default AdminClientCreatedDTO toCreatedDTO(AdminClientDTO client, String clientSecret) {
        return new AdminClientCreatedDTO(client, clientSecret);
    }
}
