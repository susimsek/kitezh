package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminClientSecret", description = "Replacement client secret returned once.")
public record AdminClientSecretDTO(
        @Schema(
                        description = "Plain-text client secret; store it securely.",
                        example = "s3cr3t-client-value",
                        format = "password")
                String clientSecret) {}
