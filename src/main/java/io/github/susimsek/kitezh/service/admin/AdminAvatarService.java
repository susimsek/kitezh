package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.UserAvatarEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAvatarDTO;
import io.github.susimsek.kitezh.mapper.AdminAvatarMapper;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class AdminAvatarService {

    private static final long MAX_AVATAR_PIXELS = 4_000_000;
    private static final int MAX_AVATAR_DIMENSION = 4_096;
    private static final String AVATAR_FIELD = "avatar";

    private final AdminUserService adminUserService;
    private final UserAvatarRepository userAvatarRepository;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminAvatarMapper adminAvatarMapper;

    @Transactional
    public AdminAvatarDTO updateAvatar(Long id, MultipartFile file, String currentUsername) {
        adminUserService.requireManageableUser(id, currentUsername);
        AvatarPayload payload = avatarPayload(file);
        UserAvatarEntity avatar =
                userAvatarRepository.findById(id).orElseGet(UserAvatarEntity::new);
        String publicId = avatar.getPublicId();
        if (publicId == null) {
            publicId = UUID.randomUUID().toString();
        }
        adminAvatarMapper.update(avatar, id, publicId, payload.contentType(), payload.content());
        UserAvatarEntity saved = userAvatarRepository.saveAndFlush(avatar);
        adminAuditEventService.avatarUpdated(id);
        return adminAvatarMapper.toDTO(avatarUrl(saved.getPublicId(), saved.getUpdatedAt()));
    }

    @Transactional
    public void deleteAvatar(Long id, String currentUsername) {
        adminUserService.requireManageableUser(id, currentUsername);
        userAvatarRepository.deleteById(id);
        adminAuditEventService.avatarDeleted(id);
    }

    private static String avatarUrl(String publicId, Instant updatedAt) {
        return "/avatars/" + publicId + "?v=" + updatedAt.toEpochMilli();
    }

    private static AvatarPayload avatarPayload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest(
                    AVATAR_FIELD, ApiErrorCode.AVATAR_EMPTY, "Avatar file is required");
        }
        if (file.getSize() > 2 * 1024 * 1024) {
            throw ApiException.badRequest(
                    AVATAR_FIELD, ApiErrorCode.AVATAR_TOO_LARGE, "Avatar must not exceed 2 MiB");
        }
        try {
            byte[] content = file.getBytes();
            String contentType = imageContentType(content);
            if (contentType == null) {
                throw ApiException.badRequest(
                        AVATAR_FIELD,
                        ApiErrorCode.AVATAR_INVALID_TYPE,
                        "Avatar must be a JPEG or PNG image");
            }
            return new AvatarPayload(content, contentType);
        } catch (IOException _) {
            throw ApiException.badRequest(
                    AVATAR_FIELD, ApiErrorCode.AVATAR_UNREADABLE, "Avatar could not be read");
        }
    }

    private static String imageContentType(byte[] content) {
        try (ImageInputStream input =
                ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            if (input == null) {
                return null;
            }
            java.util.Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width > MAX_AVATAR_DIMENSION
                        || height > MAX_AVATAR_DIMENSION
                        || (long) width * height > MAX_AVATAR_PIXELS) {
                    throw ApiException.badRequest(
                            AVATAR_FIELD,
                            ApiErrorCode.AVATAR_DIMENSIONS,
                            "Avatar dimensions must not exceed 4 megapixels");
                }
                return switch (reader.getFormatName().toLowerCase(java.util.Locale.ROOT)) {
                    case "jpeg", "jpg" -> "image/jpeg";
                    case "png" -> "image/png";
                    default -> null;
                };
            } finally {
                reader.dispose();
            }
        } catch (IOException _) {
            return null;
        }
    }

    private record AvatarPayload(byte[] content, String contentType) {

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof AvatarPayload(byte[] otherContent, String otherContentType))) {
                return false;
            }
            return Arrays.equals(content, otherContent)
                    && Objects.equals(contentType, otherContentType);
        }

        @Override
        public int hashCode() {
            return 31 * Arrays.hashCode(content) + Objects.hashCode(contentType);
        }

        @Override
        public String toString() {
            return "AvatarPayload[content="
                    + Arrays.toString(content)
                    + ", contentType="
                    + contentType
                    + "]";
        }
    }
}
