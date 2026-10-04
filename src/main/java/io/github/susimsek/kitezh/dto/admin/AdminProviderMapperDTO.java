package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminProviderMapper", description = "Identity provider claim mapper.")
public record AdminProviderMapperDTO(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String providerAlias,
        @Schema(example = "email-mapper", requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @Schema(example = "email", requiredMode = Schema.RequiredMode.REQUIRED) String sourceClaim,
        @Schema(example = "email", requiredMode = Schema.RequiredMode.REQUIRED) String target,
        @Schema(example = "user-attribute", requiredMode = Schema.RequiredMode.REQUIRED)
                String mapperType,
        @Schema(
                        example = "inherit",
                        allowableValues = {"inherit", "legacy", "import", "read_only", "force"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String syncMode,
        @Schema boolean addToIdToken,
        @Schema boolean addToAccessToken) {}
