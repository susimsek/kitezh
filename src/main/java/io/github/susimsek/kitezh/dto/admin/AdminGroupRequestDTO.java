package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

@Schema(name = "AdminGroupRequest", description = "A group to create or rename.")
public record AdminGroupRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 100, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Group name.",
                        example = "finance-operators",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Parent group identifier for a nested group.",
                        example = "1",
                        format = "int64",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Long parentId,
        @Schema(
                        description = "Multi-valued group attributes.",
                        example = "{\"department\":[\"finance\"]}",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 50, message = "{app.api.problem.violation.max_size}")
                Map<
                                @NotBlank @Size(max = 100) String,
                                @Size(max = 20) List<@NotBlank @Size(max = 1000) String>>
                        attributes,
        @Schema(
                        description = "Automatically add newly created users to this group.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Boolean defaultGroup) {

    public AdminGroupRequestDTO(String name, Long parentId) {
        this(name, parentId, Map.of(), false);
    }

    public boolean defaultGroupValue() {
        return Boolean.TRUE.equals(defaultGroup);
    }
}
