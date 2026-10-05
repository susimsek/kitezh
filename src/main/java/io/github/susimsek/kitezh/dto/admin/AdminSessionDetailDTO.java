package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(
        name = "AdminSessionDetail",
        description = "Browser session with associated OAuth2 authorizations.")
public record AdminSessionDetailDTO(
        @Schema(
                        description = "Session summary.",
                        example = "{\"id\":\"session-123\",\"username\":\"user\",\"active\":true}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AdminSessionDTO session,
        @Schema(
                        description = "Authorizations associated with the session.",
                        example =
                                "[{\"id\":\"authorization-123\",\"clientId\":\"account-console\"}]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<AdminAuthorizationDTO> authorizations) {}
