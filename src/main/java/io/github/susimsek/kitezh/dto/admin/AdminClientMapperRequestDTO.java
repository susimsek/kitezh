package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminClientMapperRequest", description = "Client claim mapper configuration.")
public record AdminClientMapperRequestDTO(
        @NotBlank
                @Size(max = 100)
                @Schema(
                        description = "Mapper name.",
                        example = "Email claim",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @NotBlank
                @Pattern(
                        regexp =
                                io.github.susimsek.kitezh.security.ProtocolMapperTypes
                                        .SUPPORTED_TYPES_REGEX)
                @Schema(
                        description = "Allow-listed mapper type.",
                        example = "user-property",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String mapperType,
        @Size(max = 200)
                @Schema(
                        description = "Source property or profile attribute name.",
                        example = "email",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String source,
        @Size(max = 200)
                @Schema(
                        description = "JWT claim name.",
                        example = "email",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String claimName,
        @Schema(
                        description = "Add the claim to ID tokens.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean addToIdToken,
        @Schema(
                        description = "Add the claim to access tokens.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean addToAccessToken,
        @Size(max = 1000)
                @Schema(
                        description = "Constant value for hardcoded claims or an audience value.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String value,
        @jakarta.validation.constraints.Min(0)
                @jakarta.validation.constraints.Max(10000)
                @Schema(
                        description = "Evaluation order; lower values run first.",
                        example = "100",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Integer priority) {}
