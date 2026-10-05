package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

class AccountRegistrationMapperTest {

    private final AccountRegistrationMapper mapper =
            Mappers.getMapper(AccountRegistrationMapper.class);

    @Test
    void mapsRegistrationFieldsAndInitializesSecurityDefaults() {
        AuthorityEntity authority = new AuthorityEntity(1L, "ROLE_USER");

        UserEntity user =
                mapper.toEntity(
                        "ada",
                        "Ada",
                        "Lovelace",
                        "ada@example.test",
                        "encoded-password",
                        Set.of(authority));

        assertThat(user)
                .extracting(
                        UserEntity::getUsername,
                        UserEntity::getFirstName,
                        UserEntity::getLastName,
                        UserEntity::getEmail,
                        UserEntity::getPassword)
                .containsExactly("ada", "Ada", "Lovelace", "ada@example.test", "encoded-password");
        assertThat(user.isEnabled()).isTrue();
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(user.getAuthorities()).containsExactly(authority);
        assertThat(user.getGroups()).isEmpty();
        assertThat(user.getClientRoles()).isEmpty();
    }

    @Test
    void preservesNullRegistrationValues() {
        UserEntity user = mapper.toEntity(null, null, null, null, null, null);

        assertThat(user).isNull();
    }
}
