package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAvatarDTO;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAvatarService;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class AccountAvatarServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserAvatarRepository userAvatarRepository;
    @Mock private AdminAvatarService adminAvatarService;

    @Test
    void returnsVersionedAvatarUrlWhenConfigured() {
        UserEntity user = user(7L);
        UserAvatarRepository.AvatarVersion version = mock(UserAvatarRepository.AvatarVersion.class);
        when(userRepository.findByUsername("user")).thenReturn(Optional.of(user));
        when(userAvatarRepository.findVersionByUserId(7L)).thenReturn(Optional.of(version));
        when(version.getPublicId()).thenReturn("public-avatar");
        when(version.getUpdatedAt()).thenReturn(Instant.parse("2026-09-13T12:00:00Z"));

        assertThat(service().avatar("user").avatarUrl())
                .isEqualTo("/avatars/public-avatar?v=1789300800000");
    }

    @Test
    void returnsSocialPictureWhenNoLocalAvatarIsConfigured() {
        UserEntity user = user(7L);
        user.setPictureUrl("https://images.example.test/ada.jpg");
        when(userRepository.findByUsername("user")).thenReturn(Optional.of(user));
        when(userAvatarRepository.findVersionByUserId(7L)).thenReturn(Optional.empty());

        assertThat(service().avatar("user").avatarUrl())
                .isEqualTo("https://images.example.test/ada.jpg");
    }

    @Test
    void updatesAndDeletesOnlyTheAuthenticatedUserAvatar() {
        UserEntity user = user(7L);
        MockMultipartFile file =
                new MockMultipartFile("file", "avatar.png", "image/png", new byte[] {1});
        when(userRepository.findByUsername("user")).thenReturn(Optional.of(user));
        when(adminAvatarService.updateAvatar(7L, file, "user"))
                .thenReturn(new AdminAvatarDTO("/avatars/new-avatar?v=1"));

        assertThat(service().updateAvatar("user", file).avatarUrl())
                .isEqualTo("/avatars/new-avatar?v=1");
        service().deleteAvatar("user");

        verify(adminAvatarService).updateAvatar(7L, file, "user");
        verify(adminAvatarService).deleteAvatar(7L, "user");
    }

    private AccountAvatarService service() {
        return new AccountAvatarService(userRepository, userAvatarRepository, adminAvatarService);
    }

    private static UserEntity user(Long id) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername("user");
        return user;
    }
}
