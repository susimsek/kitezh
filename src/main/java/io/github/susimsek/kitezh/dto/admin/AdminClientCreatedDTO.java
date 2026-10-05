package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminClientCreated", description = "Newly created client and its one-time secret.")
public record AdminClientCreatedDTO(
        @Schema(
                        description = "Created registered client.",
                        example = "{\"id\":\"client-123\",\"clientId\":\"reporting-client\"}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AdminClientDTO client,
        @Schema(
                        description = "Plain-text secret; shown only once after creation.",
                        example = "s3cr3t-client-value",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientSecret) {}
