package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.AccountProfileRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleUserDTO;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.data.domain.PageImpl;

class MapperDefaultsCoverageTest {

    @Test
    void mapsDefaultProfileAndAdminRoleHelpers() {
        AccountProfileMapper profile = Mappers.getMapper(AccountProfileMapper.class);
        var normalized =
                profile.normalize(
                        new AccountProfileRequestDTO(
                                " Alice ", " ", " ALICE@EXAMPLE.TEST ", " pw "));
        assertThat(normalized)
                .isEqualTo(new AccountProfileRequestDTO("Alice", null, "alice@example.test", "pw"));
        assertThat(profile.trimToNull(null)).isNull();
        assertThat(profile.trimToNull(" ")).isNull();
        assertThat(profile.normalizeEmail(" ")).isNull();

        AdminRoleMapper roleMapper = Mappers.getMapper(AdminRoleMapper.class);
        AuthorityEntity role = roleMapper.toEntity("ROLE_USER");
        assertThat(role.getName()).isEqualTo("ROLE_USER");
        assertThat(
                        roleMapper.toDetailDTO(
                                "ROLE_USER",
                                "description",
                                1,
                                false,
                                new PageImpl<>(List.of(new AdminRoleUserDTO(1L, "alice", true)))))
                .isNotNull();
    }

    @Test
    void mapsRequiredActionImpersonationSessionAndUserHelpers() {
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();
        definition.setActionKey("VERIFY_EMAIL");
        definition.setDisplayName("Verify email");
        definition.setDescription("Description");
        definition.setEnabled(true);
        definition.setGlobalPolicy(true);
        definition.setVersion(2L);
        definition.setPriority(3);
        definition.setConfiguration("{}");
        RequiredActionMapper required = Mappers.getMapper(RequiredActionMapper.class);
        assertThat(required.toDTO(definition, 4L).version()).isEqualTo(4L);
        assertThat(required.toAdminDTO(definition).key()).isEqualTo("VERIFY_EMAIL");

        assertThat(
                        Mappers.getMapper(AdminImpersonationMapper.class)
                                .toDTO("/impersonate", "alice", "ticket"))
                .isNotNull();

        AdminSessionMapper sessions = Mappers.getMapper(AdminSessionMapper.class);
        assertThat(sessions.splitScopes(null)).isEmpty();
        assertThat(sessions.splitScopes("openid email,openid")).containsExactly("openid", "email");

        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setAuthorities(Set.of(authority("ROLE_USER")));
        assertThat(Mappers.getMapper(AdminUserMapper.class).authorities(user))
                .containsExactly("ROLE_USER");
    }

    @Test
    void invokesAuthorizationClaimNormalizerForMapAndNonMapMetadata() throws Exception {
        var method =
                AuthorizationMapper.class.getDeclaredMethod("readClaims", Map.class, String.class);
        method.setAccessible(true);
        assertThat(method.invoke(null, Map.of("claims", Map.of(1, "value")), "claims"))
                .isEqualTo(Map.of("1", "value"));
        assertThat(method.invoke(null, Map.of("claims", "not-a-map"), "claims"))
                .isEqualTo(Map.of());
    }

    private static AuthorityEntity authority(String name) {
        AuthorityEntity authority = new AuthorityEntity();
        authority.setName(name);
        return authority;
    }
}
