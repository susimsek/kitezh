package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminIdentityProvider",
        description = "Keycloak-style identity provider configuration.")
public record AdminIdentityProviderDTO(
        @Schema(
                        description = "Internal provider id.",
                        example = "8d2f...",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Spring registration id.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String registrationId,
        @Schema(
                        description = "Provider implementation type.",
                        example = "oidc",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerType,
        @Schema(
                        description = "Display name on login and account pages.",
                        example = "Google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Unique provider alias.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @Schema(
                        description = "Allowlisted icon key rendered by login and account UIs.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String iconKey,
        @Schema(description = "Use a shorter OAuth state value for this provider.")
                boolean shortStateParameter,
        @Schema(description = "Preserve case when importing provider usernames.")
                boolean caseSensitiveUsername,
        @Schema(description = "Whether the provider is enabled.") boolean enabled,
        @Schema(description = "Whether credentials are configured.") boolean configured,
        @Schema(description = "Hide from the login page.") boolean hideOnLogin,
        @Schema(description = "Allow linking only.") boolean accountLinkingOnly,
        @Schema(description = "Trust provider email claims.") boolean trustEmail,
        @Schema(description = "Require MFA after provider login.") boolean mfaRequired,
        @Schema(description = "Required claims, comma separated.") String requiredClaims,
        @Schema(description = "Store provider tokens.") boolean storeTokens,
        @Schema(description = "Allow reading stored provider tokens.") boolean storedTokensReadable,
        @Schema(description = "Login page order.") int guiOrder,
        @Schema(
                        description = "Account Console visibility.",
                        allowableValues = {"always", "when-linked", "never"})
                String showInAccountConsole,
        @Schema(
                        description =
                                "User synchronization mode: legacy, import, read_only, or force.",
                        allowableValues = {"legacy", "import", "read_only", "force"},
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String syncMode,
        @Schema(description = "Client id.") String clientId,
        @Schema(description = "Whether a client secret is configured.")
                boolean clientSecretConfigured,
        @Schema(description = "Authorization endpoint.", nullable = true) String authorizationUri,
        @Schema(description = "Token endpoint.", nullable = true) String tokenUri,
        @Schema(description = "User-info endpoint.", nullable = true) String userInfoUri,
        @Schema(description = "JWK set endpoint.", nullable = true) String jwkSetUri,
        @Schema(description = "Issuer endpoint.", nullable = true) String issuerUri,
        @Schema(description = "OAuth client authentication method.")
                String clientAuthenticationMethod,
        @Schema(description = "Requested scopes.") String scopes,
        @Schema(description = "User-name claim.") String userNameAttribute,
        @Schema(description = "Number of configured mappers.") long mapperCount,
        @Schema(description = "SAML metadata URL.", nullable = true) String samlMetadataUri,
        @Schema(description = "SAML asserting-party entity ID.", nullable = true)
                String samlAssertingPartyEntityId,
        @Schema(description = "SAML single sign-on URL.", nullable = true)
                String samlSingleSignOnServiceUrl,
        @Schema(description = "SAML single logout URL.", nullable = true)
                String samlSingleLogoutServiceUrl,
        @Schema(description = "SAML identity-provider certificate.", nullable = true)
                String samlIdpCertificate,
        @Schema(description = "Whether the SAML signing key is configured.")
                boolean samlSigningPrivateKeyConfigured,
        @Schema(description = "SAML service-provider signing certificate.", nullable = true)
                String samlSigningCertificate,
        @Schema(description = "SAML service-provider entity ID.", nullable = true)
                String samlServiceProviderEntityId,
        @Schema(description = "Sign SAML AuthnRequests.") boolean samlSignAuthnRequests,
        @Schema(description = "Require signed SAML assertions.") boolean samlWantAssertionsSigned,
        @Schema(description = "SAML NameID format.", nullable = true) String samlNameIdFormat,
        @Schema(description = "SAML principal attribute name.", nullable = true)
                String samlPrincipalAttribute,
        @Schema(description = "SAML email attribute name.", nullable = true)
                String samlEmailAttribute,
        @Schema(description = "SAML first-name attribute name.", nullable = true)
                String samlFirstNameAttribute,
        @Schema(description = "SAML last-name attribute name.", nullable = true)
                String samlLastNameAttribute,
        @Schema(description = "SAML groups attribute name.", nullable = true)
                String samlGroupsAttribute,
        @Schema(description = "Whether the SAML decryption key is configured.")
                boolean samlDecryptionPrivateKeyConfigured,
        @Schema(description = "SAML service-provider decryption certificate.", nullable = true)
                String samlDecryptionCertificate,
        @Schema(description = "SAML signature algorithm URI.", nullable = true)
                String samlSignatureAlgorithm,
        @Schema(description = "SAML AuthnRequest binding.") String samlAuthnRequestBinding,
        @Schema(description = "SAML response binding.") String samlResponseBinding,
        @Schema(description = "SAML logout binding.") String samlLogoutBinding,
        @Schema(description = "Force re-authentication at the SAML provider.")
                boolean samlForceAuthentication,
        @Schema(description = "Forward login_hint as the SAML Subject.") boolean samlPassSubject) {

    public AdminIdentityProviderDTO(
            String id,
            String registrationId,
            String providerType,
            String displayName,
            String alias,
            String iconKey,
            boolean shortStateParameter,
            boolean caseSensitiveUsername,
            boolean enabled,
            boolean configured,
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
            String clientId,
            boolean clientSecretConfigured,
            String authorizationUri,
            String tokenUri,
            String userInfoUri,
            String jwkSetUri,
            String issuerUri,
            String clientAuthenticationMethod,
            String scopes,
            String userNameAttribute,
            long mapperCount) {
        this(
                id,
                registrationId,
                providerType,
                displayName,
                alias,
                iconKey,
                shortStateParameter,
                caseSensitiveUsername,
                enabled,
                configured,
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
                clientId,
                clientSecretConfigured,
                authorizationUri,
                tokenUri,
                userInfoUri,
                jwkSetUri,
                issuerUri,
                clientAuthenticationMethod,
                scopes,
                userNameAttribute,
                mapperCount,
                null,
                null,
                null,
                null,
                null,
                false,
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
                false,
                null,
                null,
                "REDIRECT",
                "POST",
                "REDIRECT",
                false,
                false);
    }
}
