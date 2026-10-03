package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.UserAvatarEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.mapper.AdminAvatarMapper;
import io.github.susimsek.springauthserversamples.repository.UserAvatarRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AdminAvatarServiceTest {

    @Mock private AdminUserService adminUserService;
    @Mock private UserAvatarRepository userAvatarRepository;
    @Mock private AdminAuditEventService adminAuditEventService;

    @Test
    void uploadingAvatarUsesDetectedImageTypeAndVersionedUrl() {
        UserEntity user = new UserEntity();
        user.setId(5L);
        when(adminUserService.requireManageableUser(5L, "admin")).thenReturn(user);
        when(userAvatarRepository.findById(5L)).thenReturn(java.util.Optional.empty());
        when(userAvatarRepository.saveAndFlush(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(
                        invocation -> {
                            UserAvatarEntity avatar = invocation.getArgument(0);
                            avatar.setPublicId("avatar-public-id");
                            avatar.setUpdatedAt(Instant.parse("2026-08-20T12:00:00Z"));
                            return avatar;
                        });

        var view =
                service()
                        .updateAvatar(
                                5L,
                                new MockMultipartFile(
                                        "file",
                                        "avatar.png",
                                        "text/plain",
                                        Base64.getDecoder()
                                                .decode(
                                                        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlBdkcAAAAASUVORK5CYII=")),
                                "admin");

        assertThat(view.avatarUrl()).isEqualTo("/avatars/avatar-public-id?v=1787227200000");
        verify(userAvatarRepository).saveAndFlush(org.mockito.ArgumentMatchers.any());
        verify(adminAuditEventService).avatarUpdated(5L);
    }

    @Test
    void uploadingNonImageAvatarIsRejected() {
        UserEntity user = new UserEntity();
        user.setId(5L);
        when(adminUserService.requireManageableUser(5L, "admin")).thenReturn(user);

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateAvatar(
                                                5L,
                                                new MockMultipartFile(
                                                        "file",
                                                        "avatar.txt",
                                                        "image/png",
                                                        "not an image".getBytes()),
                                                "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Avatar must be a JPEG or PNG image");
    }

    @Test
    void replacesExistingJpegAvatarWithoutRegeneratingItsPublicId() throws Exception {
        UserEntity user = new UserEntity();
        user.setId(5L);
        UserAvatarEntity existing = new UserAvatarEntity();
        existing.setPublicId("existing-public-id");
        existing.setUpdatedAt(Instant.parse("2026-08-20T12:00:00Z"));
        when(adminUserService.requireManageableUser(5L, "admin")).thenReturn(user);
        when(userAvatarRepository.findById(5L)).thenReturn(java.util.Optional.of(existing));
        when(userAvatarRepository.saveAndFlush(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var view =
                service()
                        .updateAvatar(
                                5L,
                                new MockMultipartFile(
                                        "file", "avatar.jpg", "image/jpeg", image("jpg", 2, 2)),
                                "admin");

        assertThat(view.avatarUrl()).isEqualTo("/avatars/existing-public-id?v=1787227200000");
        verify(userAvatarRepository).saveAndFlush(existing);
        verify(adminAuditEventService).avatarUpdated(5L);
    }

    @Test
    void rejectsEmptyOversizedUnreadableAndOversizedDimensionAvatars() throws Exception {
        UserEntity user = new UserEntity();
        user.setId(5L);
        when(adminUserService.requireManageableUser(5L, "admin")).thenReturn(user);

        assertThatThrownBy(() -> service().updateAvatar(5L, null, "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Avatar file is required");
        assertThatThrownBy(
                        () ->
                                service()
                                        .updateAvatar(
                                                5L,
                                                new MockMultipartFile("file", new byte[0]),
                                                "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Avatar file is required");
        assertThatThrownBy(
                        () ->
                                service()
                                        .updateAvatar(
                                                5L,
                                                new MockMultipartFile(
                                                        "file", new byte[2 * 1024 * 1024 + 1]),
                                                "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Avatar must not exceed 2 MiB");

        MultipartFile unreadable = mock(MultipartFile.class);
        when(unreadable.isEmpty()).thenReturn(false);
        when(unreadable.getSize()).thenReturn(10L);
        when(unreadable.getBytes()).thenThrow(new IOException("read failure"));
        assertThatThrownBy(() -> service().updateAvatar(5L, unreadable, "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Avatar could not be read");

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateAvatar(
                                                5L,
                                                new MockMultipartFile(
                                                        "file",
                                                        "large.png",
                                                        "image/png",
                                                        image("png", 2049, 2049)),
                                                "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Avatar dimensions must not exceed 4 megapixels");
    }

    @Test
    void rejectsUnsupportedImageFormat() {
        UserEntity user = new UserEntity();
        user.setId(5L);
        when(adminUserService.requireManageableUser(5L, "admin")).thenReturn(user);

        assertThatThrownBy(
                        () ->
                                service()
                                        .updateAvatar(
                                                5L,
                                                new MockMultipartFile(
                                                        "file",
                                                        "avatar.gif",
                                                        "image/gif",
                                                        image("gif", 1, 1)),
                                                "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Avatar must be a JPEG or PNG image");
    }

    @Test
    void deletingAvatarCreatesAdminAuditEvent() {
        service().deleteAvatar(5L, "admin");

        verify(adminUserService).requireManageableUser(5L, "admin");
        verify(userAvatarRepository).deleteById(5L);
        verify(adminAuditEventService).avatarDeleted(5L);
    }

    @Test
    void comparesAndDescribesAvatarPayloads() throws Exception {
        Class<?> payloadType =
                Class.forName(
                        "io.github.susimsek.springauthserversamples.service.admin.AdminAvatarService$AvatarPayload");
        var constructor = payloadType.getDeclaredConstructor(byte[].class, String.class);
        constructor.setAccessible(true);
        Object first = constructor.newInstance(new byte[] {1, 2}, "image/png");
        Object equal = constructor.newInstance(new byte[] {1, 2}, "image/png");
        Object different = constructor.newInstance(new byte[] {2}, "image/png");

        assertThat(first).isEqualTo(equal).isNotEqualTo(different).hasSameHashCodeAs(equal);
        assertThat(first.toString()).contains("image/png", "[1, 2]");
    }

    private AdminAvatarService service() {
        return new AdminAvatarService(
                adminUserService,
                userAvatarRepository,
                adminAuditEventService,
                Mappers.getMapper(AdminAvatarMapper.class));
    }

    private static byte[] image(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThat(javax.imageio.ImageIO.write(image, format, output)).isTrue();
        return output.toByteArray();
    }
}
