package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Protected resource and its operations.")
public record AdminAuthorizationResourceDTO(
        @Schema(
                        description = "Resource identifier.",
                        example = "6c6651a4-8b51-4aa9-8ddc-54694db9dafe",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Owning resource-server client ID.",
                        example = "orders-api",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String resourceServerClientId,
        @Schema(
                        description = "Resource name.",
                        example = "Orders",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(description = "Resource type.", example = "order", nullable = true) String type,
        @Schema(description = "Resource URI.", example = "/orders/*", nullable = true) String uri,
        @Schema(
                        description = "Owner subject.",
                        example = "alice",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String ownerSubject,
        @Schema(
                        description = "Owner-managed access flag.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean ownerManagedAccess,
        @Schema(description = "Supported operations.", requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> scopes) {}
