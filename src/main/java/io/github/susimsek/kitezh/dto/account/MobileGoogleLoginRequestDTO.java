package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "MobileGoogleLoginRequest",
        description = "Signed Google ID token and the mobile PKCE request.")
public record MobileGoogleLoginRequestDTO(
        @Schema(
                        description = "Registered mobile public client ID.",
                        example = "mobile-account-console")
                @NotBlank
                @Size(max = 100)
                String clientId,
        @Schema(
                        description = "Redirect URI registered for this client.",
                        example = "kitezh://oauth/callback")
                @NotBlank
                @Size(max = 2048)
                String redirectUri,
        @Schema(
                        description = "Requested space-separated registered scopes.",
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
                        description = "S256 code challenge derived from the client-held verifier.",
                        example = "a6Wv5X0kqfRikc7VROz0t4M9gGQ59VowjMfeGhdqK5o")
                @NotBlank
                @Pattern(regexp = "[A-Za-z0-9_-]{43}")
                String codeChallenge,
        @Schema(
                        description = "The only accepted mobile challenge method.",
                        example = "S256",
                        allowableValues = "S256")
                @NotBlank
                @Pattern(regexp = "S256")
                String codeChallengeMethod,
        @Schema(
                        description = "OIDC nonce bound to the Kitezh authorization code.",
                        example = "W7mUGxjCzN7pK6tPMF2BLw")
                @NotBlank
                @Pattern(regexp = "[A-Za-z0-9._~-]{16,256}")
                String nonce,
        @Schema(description = "Validated calling platform.", example = "ANDROID") @NotNull
                MobileLoginPlatform platform,
        @Schema(description = "Signed ID token returned by native Google Sign-In.")
                @NotBlank
                @Size(max = 8192)
                String idToken) {}
