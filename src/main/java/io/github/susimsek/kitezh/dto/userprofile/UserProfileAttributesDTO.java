package io.github.susimsek.kitezh.dto.userprofile;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

@Schema(
        name = "UserProfileAttributes",
        description = "User profile definitions and current values.")
public record UserProfileAttributesDTO(
        @Schema(
                        description = "Enabled definitions available to this profile.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<UserProfileAttributeDefinitionDTO> definitions,
        @Schema(
                        description = "Values keyed by stable attribute name.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, List<String>> attributes) {}
