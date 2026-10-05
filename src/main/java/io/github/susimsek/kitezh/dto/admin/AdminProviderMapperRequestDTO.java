package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminProviderMapperRequest",
        description = "Identity provider claim mapper request.")
public record AdminProviderMapperRequestDTO(
        @Schema(example = "email-mapper", requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9_.-]{0,99}")
                String name,
        @Schema(example = "email", requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String sourceClaim,
        @Schema(example = "email", requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String target,
        @Schema(example = "user-attribute") @NotBlank @Pattern(regexp = "user-attribute|claim")
                String mapperType,
        @Schema(
                        example = "inherit",
                        allowableValues = {"inherit", "legacy", "import", "read_only", "force"})
                @NotBlank
                @Pattern(regexp = "(?i)inherit|legacy|import|read[_-]only|force")
                String syncMode,
        @Schema boolean addToIdToken,
        @Schema boolean addToAccessToken) {}
