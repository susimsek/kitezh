package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.web.webauthn.api.Bytes;

class WebAuthnUserEntityRepositoryTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final WebAuthnUserEntityRepository repository =
            new WebAuthnUserEntityRepository(userRepository);

    @Test
    void mapsUsersByHandleAndUsername() {
        UserEntity user = new UserEntity();
        user.setId(42L);
        user.setUsername("alice");
        user.setFirstName("Alice");
        user.setLastName("Example");
        when(userRepository.findById(42L)).thenReturn(Optional.of(user));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));

        var byId = repository.findById(WebAuthnUserEntityRepository.userHandle(42L));
        var byName = repository.findByUsername("alice");

        assertThat(byId.getName()).isEqualTo("alice");
        assertThat(byId.getDisplayName()).isEqualTo("Alice Example");
        assertThat(byName.getId()).isEqualTo(WebAuthnUserEntityRepository.userHandle(42L));
    }

    @Test
    void fallsBackToUsernameForBlankNamesAndHandlesMissingUsers() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("blank-names");
        user.setFirstName(" ");
        user.setLastName(null);
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());

        assertThat(
                        repository
                                .findById(WebAuthnUserEntityRepository.userHandle(7L))
                                .getDisplayName())
                .isEqualTo("blank-names");
        assertThat(repository.findByUsername("missing")).isNull();
        assertThat(repository.findById(new Bytes(new byte[] {1}))).isNull();
    }

    @Test
    void saveAndDeleteAreIntentionallyNoOps() {
        repository.save(mock());
        repository.delete(WebAuthnUserEntityRepository.userHandle(1L));

        verifyNoInteractions(userRepository);
    }
}
