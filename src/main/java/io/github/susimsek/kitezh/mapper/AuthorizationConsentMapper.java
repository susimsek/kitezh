package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.domain.AuthorizationConsentId;
import java.util.Set;
import org.mapstruct.Context;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.Named;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsent;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AuthorizationConsentMapper {

    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "id", source = "consent", qualifiedByName = "toAuthorizationConsentId")
    @Mapping(
            target = "authorities",
            source = "consent.authorities",
            qualifiedByName = "writeAuthorities")
    AuthorizationConsentEntity toEntity(
            OAuth2AuthorizationConsent consent, @Context AuthorizationServerMapperSupport support);

    default OAuth2AuthorizationConsent toObject(
            AuthorizationConsentEntity entity, @Context AuthorizationServerMapperSupport support) {
        OAuth2AuthorizationConsent.Builder builder =
                OAuth2AuthorizationConsent.withId(
                        entity.getId().getRegisteredClientId(), entity.getId().getPrincipalName());
        support.readAuthorities(entity.getAuthorities()).forEach(builder::authority);
        return builder.build();
    }

    @Named("toAuthorizationConsentId")
    default AuthorizationConsentId toAuthorizationConsentId(
            OAuth2AuthorizationConsent consent, @Context AuthorizationServerMapperSupport support) {
        return support.newAuthorizationConsentId(
                consent.getRegisteredClientId(), consent.getPrincipalName());
    }

    @Named("writeAuthorities")
    default String writeAuthorities(
            Set<GrantedAuthority> authorities, @Context AuthorizationServerMapperSupport support) {
        return support.writeAuthorities(authorities);
    }
}
