package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import java.nio.ByteBuffer;
import java.util.Arrays;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;

/** Maps WebAuthn user handles to the application's stable user identifiers. */
public final class WebAuthnUserEntityRepository implements PublicKeyCredentialUserEntityRepository {

    private static final int USER_HANDLE_LENGTH = Long.BYTES * 2;

    private final UserRepository userRepository;

    WebAuthnUserEntityRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public PublicKeyCredentialUserEntity findById(Bytes id) {
        byte[] bytes = id.getBytes();
        if (bytes.length != USER_HANDLE_LENGTH) {
            return null;
        }
        long userId = ByteBuffer.wrap(bytes).getLong(Long.BYTES);
        return userRepository.findById(userId).map(this::toUserEntity).orElse(null);
    }

    @Override
    public PublicKeyCredentialUserEntity findByUsername(String username) {
        return userRepository.findByUsername(username).map(this::toUserEntity).orElse(null);
    }

    @Override
    public void save(PublicKeyCredentialUserEntity userEntity) {
        // Application users already own their WebAuthn user entity; there is no second
        // mutable user record to persist here.
    }

    @Override
    public void delete(Bytes id) {
        // The application user must not be deleted when a WebAuthn credential is removed.
    }

    public static Bytes userHandle(Long userId) {
        return new Bytes(
                ByteBuffer.allocate(USER_HANDLE_LENGTH).putLong(0L).putLong(userId).array());
    }

    private PublicKeyCredentialUserEntity toUserEntity(UserEntity user) {
        String displayName =
                String.join(
                                " ",
                                Arrays.asList(user.getFirstName(), user.getLastName()).stream()
                                        .filter(value -> value != null && !value.isBlank())
                                        .toList())
                        .trim();
        return ImmutablePublicKeyCredentialUserEntity.builder()
                .id(userHandle(user.getId()))
                .name(user.getUsername())
                .displayName(displayName.isBlank() ? user.getUsername() : displayName)
                .build();
    }
}
