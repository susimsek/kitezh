package io.github.susimsek.kitezh.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserAvatarEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;

@ExtendWith(MockitoExtension.class)
class AvatarControllerTest {

    @Mock private UserAvatarRepository userAvatarRepository;
    @Mock private UserRepository userRepository;

    @Test
    void returnsNotModifiedWhenEtagMatchesAvatarVersion() {
        UserAvatarEntity avatar = new UserAvatarEntity();
        avatar.setPublicId("avatar-public-id");
        avatar.setUpdatedAt(Instant.parse("2026-08-20T12:00:00Z"));
        avatar.setContentType("image/png");
        avatar.setContent(new byte[] {1});
        when(userAvatarRepository.findByPublicId("avatar-public-id"))
                .thenReturn(Optional.of(avatar));

        var response =
                new AvatarController(userAvatarRepository, userRepository)
                        .avatar(
                                "avatar-public-id",
                                1787227200000L,
                                "\"avatar-avatar-public-id-1787227200000\"");

        assertThat(response.getStatusCode().value()).isEqualTo(304);
        assertThat(response.getHeaders().getETag())
                .isEqualTo("\"avatar-avatar-public-id-1787227200000\"");
        assertThat(response.getHeaders().getCacheControl()).contains("max-age=31536000");
    }

    @Test
    void returnsOnlyTheCurrentUsersAvatar() {
        UserEntity user = new UserEntity();
        user.setId(5L);
        UserAvatarEntity avatar = new UserAvatarEntity();
        avatar.setUserId(5L);
        avatar.setPublicId("avatar-public-id");
        avatar.setUpdatedAt(Instant.parse("2026-08-20T12:00:00Z"));
        avatar.setContentType("image/png");
        avatar.setContent(new byte[] {1});
        when(userRepository.findByUsername("user")).thenReturn(Optional.of(user));
        when(userAvatarRepository.findById(5L)).thenReturn(Optional.of(avatar));

        var response =
                new AvatarController(userAvatarRepository, userRepository)
                        .currentUserAvatar(new TestingAuthenticationToken("user", null), null);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Test
    void rejectsAnAvatarUrlWithAnOutdatedVersion() {
        UserAvatarEntity avatar = new UserAvatarEntity();
        avatar.setPublicId("avatar-public-id");
        avatar.setUpdatedAt(Instant.parse("2026-08-20T12:00:00Z"));
        when(userAvatarRepository.findByPublicId("avatar-public-id"))
                .thenReturn(Optional.of(avatar));

        var response =
                new AvatarController(userAvatarRepository, userRepository)
                        .avatar("avatar-public-id", 1L, null);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }
}
