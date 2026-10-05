package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AccountAvatar", description = "Avatar resource for the authenticated account.")
public record AccountAvatarDTO(
        @Schema(
                        description =
                                "Public, versioned avatar URL, or null when no avatar is set.",
                        example = "/avatars/user-avatar-123?v=1725438600000",
                        format = "uri-reference",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String avatarUrl) {}
