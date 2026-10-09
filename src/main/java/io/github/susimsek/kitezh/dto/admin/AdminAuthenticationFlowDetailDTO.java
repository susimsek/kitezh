package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(
        name = "AdminAuthenticationFlowDetail",
        description = "A flow with its immediate executions and sub-flows.")
public record AdminAuthenticationFlowDetailDTO(
        @Schema(description = "Flow metadata.", requiredMode = Schema.RequiredMode.REQUIRED)
                AdminAuthenticationFlowDTO flow,
        @Schema(
                        description = "Executions directly owned by the flow.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<AdminAuthenticationExecutionDTO> executions,
        @Schema(
                        description = "Sub-flows directly owned by the flow.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<AdminAuthenticationFlowDTO> subFlows,
        @Schema(
                        description =
                                "All direct executions and sub-flows in their effective order.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<AdminAuthenticationFlowNodeDTO> nodes) {}
