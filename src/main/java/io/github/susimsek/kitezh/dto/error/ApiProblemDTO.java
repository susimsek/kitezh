package io.github.susimsek.kitezh.dto.error;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** OpenAPI representation of the RFC 9457 response returned by application REST APIs. */
@Schema(name = "ApiProblem", description = "RFC 9457 API error response.")
public record ApiProblemDTO(
        @Schema(
                        description = "URI identifying the problem type.",
                        example = "urn:problem:user_invalid_username",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String type,
        @Schema(
                        description = "Short, human-readable problem title.",
                        example = "API request failed",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String title,
        @Schema(
                        description = "Human-readable explanation of the failure.",
                        example = "Username is already registered.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String detail,
        @Schema(
                        description = "HTTP status code.",
                        example = "409",
                        format = "int32",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int status,
        @Schema(
                        description = "Request instance that caused the problem.",
                        example = "/api/admin/users",
                        format = "uri-reference",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String instance,
        @Schema(
                        description = "Application-specific error code.",
                        example = "user_duplicate_username",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String errorCode,
        @Schema(
                        description = "JSON field associated with a field-specific business error.",
                        example = "username",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String field,
        @Schema(
                        description = "Request fields that failed validation.",
                        example =
                                "[{\"field\":\"email\",\"message\":\"Enter a valid email"
                                        + " address.\"}]",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                List<ApiViolationDTO> violations) {}
