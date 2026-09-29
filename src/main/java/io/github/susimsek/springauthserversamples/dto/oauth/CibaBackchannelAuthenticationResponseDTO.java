package io.github.susimsek.springauthserversamples.dto.oauth;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "CIBA backchannel authentication response.")
public record CibaBackchannelAuthenticationResponseDTO(
        @Schema(
                        description = "Opaque identifier used in the CIBA token request.",
                        example = "ciba-auth-req-id",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @JsonProperty("auth_req_id")
                String authReqId,
        @Schema(
                        description = "Lifetime of the auth_req_id in seconds.",
                        example = "300",
                        format = "int32",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @JsonProperty("expires_in")
                int expiresIn,
        @Schema(
                        description = "Minimum number of seconds between token polls.",
                        example = "5",
                        format = "int32",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @JsonInclude(JsonInclude.Include.NON_NULL)
                Integer interval,
        @Schema(
                        description =
                                "User-facing code used to identify this request for approval.",
                        example = "K7P4M2Q9",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @JsonProperty("user_code")
                @JsonInclude(JsonInclude.Include.NON_NULL)
                String userCode) {

    public CibaBackchannelAuthenticationResponseDTO(
            String authReqId, int expiresIn, Integer interval) {
        this(authReqId, expiresIn, interval, null);
    }
}
