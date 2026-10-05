package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.LdapFederationMapperType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminLdapMapperRequest", description = "LDAP federation mapper request.")
public record AdminLdapMapperRequestDTO(
        @Schema(description = "Existing mapper id; omit when creating.", nullable = true) Long id,
        @NotBlank
                @Size(max = 100)
                @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_. -]*$")
                @Schema(description = "Mapper name.", example = "Department")
                String name,
        @NotNull @Schema(description = "Mapper type.") LdapFederationMapperType type,
        @Schema(description = "Enable this mapper.") boolean enabled,
        @Size(max = 100) @Schema(description = "LDAP source attribute.", nullable = true)
                String ldapAttribute,
        @Size(max = 100) @Schema(description = "Local user attribute.", nullable = true)
                String userAttribute,
        @Size(max = 2000) @Schema(description = "Fixed mapper value.", nullable = true)
                String hardcodedValue,
        @Size(max = 200) @Schema(description = "Role/group target name.", nullable = true)
                String targetName,
        @Size(max = 1000) @Schema(description = "LDAP group search base.", nullable = true)
                String groupSearchBase,
        @Size(max = 100) @Schema(description = "LDAP group object class.", nullable = true)
                String groupObjectClass,
        @Size(max = 100) @Schema(description = "LDAP group name attribute.", nullable = true)
                String groupNameAttribute,
        @Size(max = 100) @Schema(description = "LDAP group membership attribute.", nullable = true)
                String groupMemberAttribute) {}
