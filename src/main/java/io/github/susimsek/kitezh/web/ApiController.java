package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.dto.error.ApiProblemDTO;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Marks application REST controllers that use the shared API error contract. */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ApiResponse(
        responseCode = "400",
        description = "Invalid request or validation failure.",
        content = @Content(schema = @Schema(implementation = ApiProblemDTO.class)))
@ApiResponse(
        responseCode = "401",
        description = "Bearer access token is missing, expired, or invalid.",
        content = @Content(schema = @Schema(implementation = ApiProblemDTO.class)))
@ApiResponse(
        responseCode = "403",
        description = "The token lacks the required scope or authority.",
        content = @Content(schema = @Schema(implementation = ApiProblemDTO.class)))
@ApiResponse(
        responseCode = "404",
        description = "The requested resource was not found.",
        content = @Content(schema = @Schema(implementation = ApiProblemDTO.class)))
@ApiResponse(
        responseCode = "409",
        description = "The request conflicts with the current resource state.",
        content = @Content(schema = @Schema(implementation = ApiProblemDTO.class)))
@ApiResponse(
        responseCode = "500",
        description = "An unexpected server error occurred.",
        content = @Content(schema = @Schema(implementation = ApiProblemDTO.class)))
public @interface ApiController {}
