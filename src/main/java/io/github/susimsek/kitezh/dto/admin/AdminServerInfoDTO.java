package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminServerInfo",
        description = "Authorization-server endpoint and signing-key metadata.")
public record AdminServerInfoDTO(
        @Schema(
                        description = "Configured issuer URL.",
                        example = "http://localhost:9090",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String issuer,
        @Schema(
                        description = "OpenID Provider discovery URL.",
                        example = "http://localhost:9090/.well-known/openid-configuration",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String discoveryEndpoint,
        @Schema(
                        description = "Authorization endpoint URL.",
                        example = "http://localhost:9090/oauth2/authorize",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String authorizationEndpoint,
        @Schema(
                        description = "Token endpoint URL.",
                        example = "http://localhost:9090/oauth2/token",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String tokenEndpoint,
        @Schema(
                        description = "Token introspection endpoint URL.",
                        example = "http://localhost:9090/oauth2/introspect",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String introspectionEndpoint,
        @Schema(
                        description = "Token revocation endpoint URL.",
                        example = "http://localhost:9090/oauth2/revoke",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String revocationEndpoint,
        @Schema(
                        description = "JSON Web Key Set URL.",
                        example = "http://localhost:9090/oauth2/jwks",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String jwksEndpoint,
        @Schema(
                        description = "OpenID Connect UserInfo URL.",
                        example = "http://localhost:9090/userinfo",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String userInfoEndpoint,
        @Schema(
                        description = "RP-initiated logout URL.",
                        example = "http://localhost:9090/connect/logout",
                        format = "uri",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String endSessionEndpoint,
        @Schema(
                        description = "Configured browser session timeout.",
                        example = "30m",
                        format = "duration",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String sessionTimeout,
        @Schema(
                        description = "Currently active signing key.",
                        example =
                                "{\"kid\":\"rsa-20260904\",\"type\":\"RSA\",\"algorithm\":\"RS256\",\"use\":\"sig\"}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AdminSigningKeySummaryDTO activeSigningKey) {}
