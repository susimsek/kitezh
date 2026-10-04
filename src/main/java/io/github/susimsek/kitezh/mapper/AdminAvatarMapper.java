package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.UserAvatarEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAvatarDTO;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminAvatarMapper {

    default AdminAvatarDTO toDTO(String avatarUrl) {
        return new AdminAvatarDTO(avatarUrl);
    }

    default void update(
            UserAvatarEntity target,
            Long userId,
            String publicId,
            String contentType,
            byte[] content) {
        target.setUserId(userId);
        target.setPublicId(publicId);
        target.setContentType(contentType);
        target.setContent(content);
    }
}
