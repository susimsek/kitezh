package io.github.susimsek.kitezh.dto.admin;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminImpersonation", description = "One-time browser impersonation handoff.")
public record AdminImpersonationDTO(
        @Schema(
                        description = "Relative URL to open in the same browser.",
                        example = "/impersonation/accept",
                        format = "uri-reference",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String url,
        @Schema(
                        description = "Target username.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @JsonIgnore
                @Schema(
                        hidden = true,
                        description = "Internal one-time ticket; never serialized.",
                        example = "opaque-ticket")
                String ticket) {}
