package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminAvatar", description = "Avatar resource returned after an upload.")
public record AdminAvatarDTO(
        @Schema(
                        description = "Public, versioned avatar URL.",
                        example = "/avatars/user-avatar-123?v=1725438600000",
                        format = "uri-reference",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String avatarUrl) {}
