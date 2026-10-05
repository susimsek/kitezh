package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.LdapFederationMapperType;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminLdapMapper", description = "LDAP federation mapper configuration.")
public record AdminLdapMapperDTO(
        @Schema(description = "Mapper identifier.", example = "12") Long id,
        @Schema(description = "Provider-scoped mapper name.", example = "Department") String name,
        @Schema(description = "Mapper implementation type.") LdapFederationMapperType type,
        @Schema(description = "Whether the mapper is active.") boolean enabled,
        @Schema(description = "LDAP source attribute.", example = "department")
                String ldapAttribute,
        @Schema(description = "Local user attribute.", example = "department") String userAttribute,
        @Schema(description = "Fixed value for hardcoded mappers.", nullable = true)
                String hardcodedValue,
        @Schema(description = "Target role or group name/path.", nullable = true) String targetName,
        @Schema(description = "LDAP group search base.", nullable = true) String groupSearchBase,
        @Schema(description = "LDAP group object class.", nullable = true) String groupObjectClass,
        @Schema(description = "LDAP group name attribute.", nullable = true)
                String groupNameAttribute,
        @Schema(description = "LDAP group membership attribute.", nullable = true)
                String groupMemberAttribute) {}
