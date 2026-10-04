package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import java.util.Set;
import org.mapstruct.Context;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.Named;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface RegisteredClientMapper {

    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "lastModifiedBy", ignore = true)
    @Mapping(
            target = "clientAuthenticationMethods",
            source = "registeredClient.clientAuthenticationMethods",
            qualifiedByName = "writeClientAuthenticationMethods")
    @Mapping(
            target = "authorizationGrantTypes",
            source = "registeredClient.authorizationGrantTypes",
            qualifiedByName = "writeAuthorizationGrantTypes")
    @Mapping(
            target = "redirectUris",
            source = "registeredClient.redirectUris",
            qualifiedByName = "writeCollection")
    @Mapping(
            target = "postLogoutRedirectUris",
            source = "registeredClient.postLogoutRedirectUris",
            qualifiedByName = "writeCollection")
    @Mapping(
            target = "scopes",
            source = "registeredClient.scopes",
            qualifiedByName = "writeCollection")
    @Mapping(
            target = "clientSettings",
            source = "registeredClient.clientSettings",
            qualifiedByName = "writeClientSettings")
    @Mapping(
            target = "tokenSettings",
            source = "registeredClient.tokenSettings",
            qualifiedByName = "writeTokenSettings")
    RegisteredClientEntity toEntity(
            RegisteredClient registeredClient, @Context AuthorizationServerMapperSupport support);

    default RegisteredClient toObject(
            RegisteredClientEntity entity, @Context AuthorizationServerMapperSupport support) {
        RegisteredClient.Builder builder =
                RegisteredClient.withId(entity.getId())
                        .clientId(entity.getClientId())
                        .clientIdIssuedAt(entity.getClientIdIssuedAt())
                        .clientSecret(entity.getClientSecret())
                        .clientSecretExpiresAt(entity.getClientSecretExpiresAt())
                        .clientName(entity.getClientName())
                        .clientSettings(support.readClientSettings(entity.getClientSettings()))
                        .tokenSettings(support.readTokenSettings(entity.getTokenSettings()));
        support.readClientAuthenticationMethods(entity.getClientAuthenticationMethods())
                .forEach(builder::clientAuthenticationMethod);
        support.readAuthorizationGrantTypes(entity.getAuthorizationGrantTypes())
                .forEach(builder::authorizationGrantType);
        support.readCollection(entity.getRedirectUris()).forEach(builder::redirectUri);
        support.readCollection(entity.getPostLogoutRedirectUris())
                .forEach(builder::postLogoutRedirectUri);
        support.readCollection(entity.getScopes()).forEach(builder::scope);
        return builder.build();
    }

    @Named("writeClientAuthenticationMethods")
    default String writeClientAuthenticationMethods(
            Set<ClientAuthenticationMethod> clientAuthenticationMethods,
            @Context AuthorizationServerMapperSupport support) {
        return support.writeClientAuthenticationMethods(clientAuthenticationMethods);
    }

    @Named("writeAuthorizationGrantTypes")
    default String writeAuthorizationGrantTypes(
            Set<AuthorizationGrantType> authorizationGrantTypes,
            @Context AuthorizationServerMapperSupport support) {
        return support.writeAuthorizationGrantTypes(authorizationGrantTypes);
    }

    @Named("writeCollection")
    default String writeCollection(
            Set<String> values, @Context AuthorizationServerMapperSupport support) {
        return support.writeCollection(values);
    }

    @Named("writeClientSettings")
    default String writeClientSettings(
            ClientSettings clientSettings, @Context AuthorizationServerMapperSupport support) {
        return support.writeClientSettings(clientSettings);
    }

    @Named("writeTokenSettings")
    default String writeTokenSettings(
            TokenSettings tokenSettings, @Context AuthorizationServerMapperSupport support) {
        return support.writeTokenSettings(tokenSettings);
    }
}
