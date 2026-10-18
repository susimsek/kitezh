package io.github.susimsek.kitezh.dto.account;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "MobileLoginResponse", description = "Native mobile login continuation result.")
public record MobileLoginResponseDTO(
        @Schema(
                        description = "Response discriminator.",
                        example = "authorized",
                        allowableValues = {
                            "authorized",
                            "mfa_required",
                            "required_actions",
                            "passkey_required"
                        })
                String status,
        @Schema(description = "Single-use SAS authorization code; only present when authorized.")
                String code,
        @Schema(description = "Original OAuth state; only present when authorized.") String state,
        @Schema(description = "Exact registered callback URI; only present when authorized.")
                String redirectUri,
        @Schema(
                        description =
                                "Short-lived opaque continuation handle; only present for"
                                        + " challenges.")
                String transactionId,
        @Schema(description = "Required actions; only present for required-actions challenges.")
                List<RequiredActionDTO> actions,
        @Schema(description = "WebAuthn request options; only present for passkey authentication.")
                Map<String, Object> publicKey) {

    public static MobileLoginResponseDTO authorized(String code, String state, String redirectUri) {
        return new MobileLoginResponseDTO("authorized", code, state, redirectUri, null, null, null);
    }

    public static MobileLoginResponseDTO mfaRequired(String transactionId) {
        return new MobileLoginResponseDTO(
                "mfa_required", null, null, null, transactionId, null, null);
    }

    public static MobileLoginResponseDTO requiredActions(
            String transactionId, List<RequiredActionDTO> actions) {
        return new MobileLoginResponseDTO(
                "required_actions", null, null, null, transactionId, List.copyOf(actions), null);
    }

    public static MobileLoginResponseDTO passkeyRequired(
            String transactionId, Map<String, Object> publicKey) {
        return new MobileLoginResponseDTO(
                "passkey_required", null, null, null, transactionId, null, publicKey);
    }
}
