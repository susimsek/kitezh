package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.web.admin.validation.OptionalAbsoluteUri;
import io.github.susimsek.kitezh.web.admin.validation.OptionalPem;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminIdentityProviderRequest",
        description = "Identity provider create or update request.")
public record AdminIdentityProviderRequestDTO(
        @Schema(
                        description = "Provider registration id.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "[a-z0-9][a-z0-9_-]{0,49}")
                String registrationId,
        @Schema(
                        description =
                                "Provider type: google, github, linkedin, microsoft, oidc, or"
                                        + " saml.",
                        example = "oidc",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 50)
                @Pattern(regexp = "(?i)google|github|linkedin|microsoft|oidc|saml")
                String providerType,
        @Schema(
                        description = "Display name.",
                        example = "Acme SSO",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 100)
                String displayName,
        @Schema(
                        description = "Unique login alias.",
                        example = "acme",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "[a-z0-9][a-z0-9_-]{0,49}")
                String alias,
        @Schema(
                        description = "Allowlisted icon key rendered by login and account UIs.",
                        example = "generic",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "[a-z][a-z0-9_-]{0,39}")
                String iconKey,
        @Schema(description = "Use a shorter OAuth state value for this provider.")
                boolean shortStateParameter,
        @Schema(description = "Preserve case when importing provider usernames.")
                boolean caseSensitiveUsername,
        @Schema(description = "Whether the provider is enabled.") boolean enabled,
        @Schema(description = "OAuth client id; not used by SAML providers.", nullable = true)
                @Size(max = 500)
                String clientId,
        @Schema(
                        description =
                                "OAuth client secret; blank on update keeps the current value.",
                        nullable = true)
                @Size(max = 1000)
                String clientSecret,
        @Schema(description = "Hide provider on login.") boolean hideOnLogin,
        @Schema(description = "Only allow account linking.") boolean accountLinkingOnly,
        @Schema(description = "Trust provider email claims.") boolean trustEmail,
        @Schema(description = "Require MFA after provider login.") boolean mfaRequired,
        @Schema(description = "Required claims, comma separated.") @Size(max = 500)
                String requiredClaims,
        @Schema(description = "Store provider tokens.") boolean storeTokens,
        @Schema(description = "Allow reading stored provider tokens.") boolean storedTokensReadable,
        @Schema(description = "Login page order.") @Min(0) int guiOrder,
        @Schema(
                        description = "Account Console visibility.",
                        allowableValues = {"always", "when-linked", "never"})
                @NotBlank
                @Pattern(regexp = "(?i)always|when-linked|never")
                String showInAccountConsole,
        @Schema(
                        description =
                                "User synchronization mode: legacy, import, read_only, or force.",
                        allowableValues = {"legacy", "import", "read_only", "force"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Pattern(regexp = "(?i)legacy|import|read[_-]only|force")
                String syncMode,
        @Schema(description = "Authorization endpoint.", nullable = true) @Size(max = 1000)
                String authorizationUri,
        @Schema(description = "Token endpoint.", nullable = true) @Size(max = 1000) String tokenUri,
        @Schema(description = "User-info endpoint.", nullable = true) @Size(max = 1000)
                String userInfoUri,
        @Schema(description = "JWK set endpoint.", nullable = true) @Size(max = 1000)
                String jwkSetUri,
        @Schema(description = "Issuer endpoint.", nullable = true) @Size(max = 1000)
                String issuerUri,
        @Schema(description = "OAuth client authentication method.") @NotBlank @Size(max = 30)
                String clientAuthenticationMethod,
        @Schema(description = "Comma-separated scopes.") @NotBlank @Size(max = 1000) String scopes,
        @Schema(description = "User-name claim.") @NotBlank @Size(max = 100)
                String userNameAttribute,
        @Schema(description = "SAML metadata URL.", format = "uri", nullable = true)
                @OptionalAbsoluteUri
                @Size(max = 2000)
                String samlMetadataUri,
        @Schema(description = "SAML asserting-party entity ID.", format = "uri", nullable = true)
                @OptionalAbsoluteUri
                @Size(max = 1000)
                String samlAssertingPartyEntityId,
        @Schema(description = "SAML single sign-on URL.", format = "uri", nullable = true)
                @OptionalAbsoluteUri
                @Size(max = 2000)
                String samlSingleSignOnServiceUrl,
        @Schema(description = "SAML single logout URL.", format = "uri", nullable = true)
                @OptionalAbsoluteUri
                @Size(max = 2000)
                String samlSingleLogoutServiceUrl,
        @Schema(description = "PEM encoded SAML identity-provider certificate.", nullable = true)
                @OptionalPem(label = "CERTIFICATE")
                @Size(max = 12000)
                String samlIdpCertificate,
        @Schema(
                        description = "PKCS#8 PEM signing key; encrypted before persistence.",
                        nullable = true)
                @OptionalPem(label = "PRIVATE KEY")
                @Size(max = 16000)
                String samlSigningPrivateKey,
        @Schema(description = "PEM encoded service-provider signing certificate.", nullable = true)
                @OptionalPem(label = "CERTIFICATE")
                @Size(max = 12000)
                String samlSigningCertificate,
        @Schema(description = "SAML service-provider entity ID.", format = "uri", nullable = true)
                @OptionalAbsoluteUri
                @Size(max = 1000)
                String samlServiceProviderEntityId,
        @Schema(description = "Sign SAML AuthnRequests.") boolean samlSignAuthnRequests,
        @Schema(description = "Require signed SAML assertions.") boolean samlWantAssertionsSigned,
        @Schema(description = "SAML NameID format.", nullable = true) @Size(max = 200)
                String samlNameIdFormat,
        @Schema(description = "SAML principal attribute name.", nullable = true) @Size(max = 200)
                String samlPrincipalAttribute,
        @Schema(description = "SAML email attribute name.", nullable = true) @Size(max = 200)
                String samlEmailAttribute,
        @Schema(description = "SAML first-name attribute name.", nullable = true) @Size(max = 200)
                String samlFirstNameAttribute,
        @Schema(description = "SAML last-name attribute name.", nullable = true) @Size(max = 200)
                String samlLastNameAttribute,
        @Schema(description = "SAML groups attribute name.", nullable = true) @Size(max = 200)
                String samlGroupsAttribute,
        @Schema(
                        description = "PKCS#8 PEM decryption key; encrypted before persistence.",
                        nullable = true)
                @OptionalPem(label = "PRIVATE KEY")
                @Size(max = 16000)
                String samlDecryptionPrivateKey,
        @Schema(
                        description = "PEM encoded service-provider decryption certificate.",
                        nullable = true)
                @OptionalPem(label = "CERTIFICATE")
                @Size(max = 12000)
                String samlDecryptionCertificate,
        @Schema(description = "SAML signature algorithm URI.", format = "uri", nullable = true)
                @OptionalAbsoluteUri
                @Size(max = 500)
                String samlSignatureAlgorithm,
        @Schema(
                        description = "SAML AuthnRequest binding.",
                        allowableValues = {"POST", "REDIRECT"})
                @Pattern(regexp = "(?i)POST|REDIRECT")
                String samlAuthnRequestBinding,
        @Schema(
                        description = "SAML response binding.",
                        allowableValues = {"POST", "REDIRECT"})
                @Pattern(regexp = "(?i)POST|REDIRECT")
                String samlResponseBinding,
        @Schema(
                        description = "SAML logout binding.",
                        allowableValues = {"POST", "REDIRECT"})
                @Pattern(regexp = "(?i)POST|REDIRECT")
                String samlLogoutBinding,
        @Schema(description = "Force re-authentication at the SAML provider.")
                boolean samlForceAuthentication,
        @Schema(description = "Forward login_hint as the SAML Subject.") boolean samlPassSubject) {

    public AdminIdentityProviderRequestDTO(
            String registrationId,
            String providerType,
            String displayName,
            String alias,
            String iconKey,
            boolean shortStateParameter,
            boolean caseSensitiveUsername,
            boolean enabled,
            String clientId,
            String clientSecret,
            boolean hideOnLogin,
            boolean accountLinkingOnly,
            boolean trustEmail,
            boolean mfaRequired,
            String requiredClaims,
            boolean storeTokens,
            boolean storedTokensReadable,
            int guiOrder,
            String showInAccountConsole,
            String syncMode,
            String authorizationUri,
            String tokenUri,
            String userInfoUri,
            String jwkSetUri,
            String issuerUri,
            String clientAuthenticationMethod,
            String scopes,
            String userNameAttribute) {
        this(
                registrationId,
                providerType,
                displayName,
                alias,
                iconKey,
                shortStateParameter,
                caseSensitiveUsername,
                enabled,
                clientId,
                clientSecret,
                hideOnLogin,
                accountLinkingOnly,
                trustEmail,
                mfaRequired,
                requiredClaims,
                storeTokens,
                storedTokensReadable,
                guiOrder,
                showInAccountConsole,
                syncMode,
                authorizationUri,
                tokenUri,
                userInfoUri,
                jwkSetUri,
                issuerUri,
                clientAuthenticationMethod,
                scopes,
                userNameAttribute,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                true,
                null,
                "NameID",
                "email",
                "givenName",
                "sn",
                "groups",
                null,
                null,
                null,
                "REDIRECT",
                "POST",
                "REDIRECT",
                false,
                false);
    }
}
