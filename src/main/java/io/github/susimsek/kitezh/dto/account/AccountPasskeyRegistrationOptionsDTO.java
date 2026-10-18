package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

@Schema(name = "AccountPasskeyRegistrationOptions", description = "Account-bound passkey options.")
public record AccountPasskeyRegistrationOptionsDTO(
        @Schema(
                        description = "Opaque ID binding completion to this account's challenge.",
                        example = "e3d1JXYlrkB4V2qp7Z8tM1u5W6zH0cQa9nYx2fP3sLg",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String challengeId,
        @Schema(
                        description = "Server-generated WebAuthn public-key creation options.",
                        example =
                                "{\"challenge\":\"base64url-challenge\",\"rp\":{\"id\":\"kitezh.example\"}}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, Object> publicKey) {}
