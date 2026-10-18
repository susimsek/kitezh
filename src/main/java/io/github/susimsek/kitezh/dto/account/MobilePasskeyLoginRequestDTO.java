package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "MobilePasskeyLoginRequest",
        description = "Mobile S256 PKCE request for passkey sign-in.")
public record MobilePasskeyLoginRequestDTO(
        @Schema(
                        description = "Registered mobile public client ID.",
                        example = "mobile-account-console")
                @NotBlank
                @Size(max = 100)
                String clientId,
        @Schema(
                        description = "Exact redirect URI registered for the client.",
                        example = "kitezh://oauth/callback")
                @NotBlank
                @Size(max = 2048)
                String redirectUri,
        @Schema(
                        description = "Requested registered scopes.",
                        example = "openid profile account-api")
                @NotBlank
                @Size(max = 512)
                String scope,
        @Schema(
                        description = "Client-generated OAuth state.",
                        example = "G4HFd3bNQqgP4BCv4f5F1wKQ9BkE1L7m")
                @NotBlank
                @Pattern(regexp = "[A-Za-z0-9._~-]{32,256}")
                String state,
        @Schema(
                        description = "S256 challenge for the client-held verifier.",
                        example = "a6Wv5X0kqfRikc7VROz0t4M9gGQ59VowjMfeGhdqK5o")
                @NotBlank
                @Pattern(regexp = "[A-Za-z0-9_-]{43}")
                String codeChallenge,
        @Schema(description = "Required PKCE method.", example = "S256", allowableValues = "S256")
                @NotBlank
                @Pattern(regexp = "S256")
                String codeChallengeMethod,
        @Schema(
                        description = "OIDC nonce bound to the authorization code.",
                        example = "W7mUGxjCzN7pK6tPMF2BLw")
                @NotBlank
                @Pattern(regexp = "[A-Za-z0-9._~-]{16,256}")
                String nonce,
        @Schema(description = "Calling mobile platform.", example = "ANDROID") @NotNull
                MobileLoginPlatform platform,
        @Schema(description = "Account username.", example = "user") @NotBlank @Size(max = 254)
                String username) {}
