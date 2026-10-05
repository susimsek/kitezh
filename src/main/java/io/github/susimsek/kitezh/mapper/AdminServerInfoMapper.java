package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.dto.admin.AdminServerInfoDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSigningKeySummaryDTO;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminServerInfoMapper {

    default AdminServerInfoDTO toDTO(
            String issuer, String sessionTimeout, AdminSigningKeySummaryDTO activeSigningKey) {
        return new AdminServerInfoDTO(
                issuer,
                issuer + "/.well-known/openid-configuration",
                issuer + "/oauth2/authorize",
                issuer + "/oauth2/token",
                issuer + "/oauth2/introspect",
                issuer + "/oauth2/revoke",
                issuer + "/oauth2/jwks",
                issuer + "/userinfo",
                issuer + "/connect/logout",
                sessionTimeout,
                activeSigningKey);
    }
}
