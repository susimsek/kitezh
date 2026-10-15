package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "Protected resource registration for Authorization Services.")
public record AdminAuthorizationResourceRequestDTO(
        @Schema(
                        description = "Owning resource-server client ID.",
                        example = "orders-api",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String resourceServerClientId,
        @Schema(
                        description = "Resource name.",
                        example = "Orders",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String name,
        @Schema(description = "Optional resource type.", example = "order") @Size(max = 200)
                String type,
        @Schema(description = "Optional resource URI.", example = "/orders/*") @Size(max = 1000)
                String uri,
        @Schema(
                        description = "Resource owner subject.",
                        example = "alice",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String ownerSubject,
        @Schema(
                        description = "Whether the owner may manage access to this resource.",
                        example = "false")
                boolean ownerManagedAccess,
        @Schema(
                        description = "Operations supported by the resource.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotEmpty
                @Size(max = 50)
                List<@NotBlank @Size(max = 100) String> scopes) {}
