package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminClientMapper", description = "Allow-listed claim mapper for one client.")
public record AdminClientMapperDTO(
        @Schema(
                        description = "Mapper identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Display name.",
                        example = "Email claim",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Allow-listed mapper type.",
                        example = "user-property",
                        allowableValues = {
                            "user-property",
                            "user-attribute",
                            "group-membership",
                            "client-role",
                            "audience",
                            "hardcoded-claim",
                            "email",
                            "full-name",
                            "locale",
                            "username"
                        },
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String mapperType,
        @Schema(
                        description = "Source property or profile attribute name.",
                        example = "email",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String source,
        @Schema(
                        description = "JWT claim name.",
                        example = "email",
                        requiredMode = Schema.RequiredMode.REQUIRED)
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
        @Schema(
                        description = "Constant value for hardcoded claims or an audience value.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String value,
        @Schema(
                        description = "Evaluation order; lower values run first.",
                        example = "100",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int priority) {}
