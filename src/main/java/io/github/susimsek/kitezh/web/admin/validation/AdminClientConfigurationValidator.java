package io.github.susimsek.kitezh.web.admin.validation;

import io.github.susimsek.kitezh.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.Set;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

public class AdminClientConfigurationValidator
        implements ConstraintValidator<ValidAdminClientConfiguration, AdminClientRequestDTO> {

    private static final String CLIENT_AUTHENTICATION_METHODS_FIELD = "clientAuthenticationMethods";
    private static final String AUTHORIZATION_GRANT_TYPES_FIELD = "authorizationGrantTypes";
    private static final String SELECTION_MESSAGE = "{app.api.problem.violation.selection}";

    private static final Set<String> ALLOWED_METHODS =
            Set.of(
                    ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue(),
                    ClientAuthenticationMethod.CLIENT_SECRET_POST.getValue(),
                    ClientAuthenticationMethod.PRIVATE_KEY_JWT.getValue(),
                    ClientAuthenticationMethod.TLS_CLIENT_AUTH.getValue(),
                    ClientAuthenticationMethod.SELF_SIGNED_TLS_CLIENT_AUTH.getValue(),
                    ClientAuthenticationMethod.NONE.getValue());
    private static final Set<String> ALLOWED_GRANTS =
            Set.of(
                    AuthorizationGrantType.AUTHORIZATION_CODE.getValue(),
                    AuthorizationGrantType.REFRESH_TOKEN.getValue(),
                    AuthorizationGrantType.CLIENT_CREDENTIALS.getValue(),
                    AuthorizationGrantTypes.CIBA,
                    AuthorizationGrantTypes.TOKEN_EXCHANGE);

    @Override
    public boolean isValid(AdminClientRequestDTO request, ConstraintValidatorContext context) {
        if (request == null
                || request.clientAuthenticationMethods() == null
                || request.authorizationGrantTypes() == null) {
            return true;
        }

        Set<String> methods = request.clientAuthenticationMethods();
        Set<String> grants = request.authorizationGrantTypes();
        context.disableDefaultConstraintViolation();
        boolean valid = validateMethods(methods, context);
        valid &= validateGrants(methods, grants, context);
        valid &= validateAuthenticationRequirements(request, methods, context);
        valid &= validateAuthorizationCode(request, methods, grants, context);
        return valid;
    }

    private static boolean validateMethods(
            Set<String> methods, ConstraintValidatorContext context) {
        if (ALLOWED_METHODS.containsAll(methods)
                && (!methods.contains(ClientAuthenticationMethod.NONE.getValue())
                        || methods.size() == 1)) {
            return true;
        }
        violation(context, CLIENT_AUTHENTICATION_METHODS_FIELD, SELECTION_MESSAGE);
        return false;
    }

    private static boolean validateGrants(
            Set<String> methods, Set<String> grants, ConstraintValidatorContext context) {
        if (ALLOWED_GRANTS.containsAll(grants)
                && (!methods.contains(ClientAuthenticationMethod.NONE.getValue())
                        || !grants.contains(
                                AuthorizationGrantType.CLIENT_CREDENTIALS.getValue()))) {
            return true;
        }
        violation(context, AUTHORIZATION_GRANT_TYPES_FIELD, SELECTION_MESSAGE);
        return false;
    }

    private static boolean validateAuthenticationRequirements(
            AdminClientRequestDTO request,
            Set<String> methods,
            ConstraintValidatorContext context) {
        boolean valid = true;
        if (methods.contains(ClientAuthenticationMethod.PRIVATE_KEY_JWT.getValue())
                && !hasPrivateKeyJwtSettings(request)) {
            violation(context, CLIENT_AUTHENTICATION_METHODS_FIELD, SELECTION_MESSAGE);
            valid = false;
        }
        if (methods.contains(ClientAuthenticationMethod.TLS_CLIENT_AUTH.getValue())
                && isBlank(request.x509CertificateSubjectDN())) {
            violation(context, CLIENT_AUTHENTICATION_METHODS_FIELD, SELECTION_MESSAGE);
            valid = false;
        }
        return valid;
    }

    private static boolean validateAuthorizationCode(
            AdminClientRequestDTO request,
            Set<String> methods,
            Set<String> grants,
            ConstraintValidatorContext context) {
        boolean authorizationCode =
                grants.contains(AuthorizationGrantType.AUTHORIZATION_CODE.getValue());
        boolean valid = true;
        if (authorizationCode
                && (request.redirectUris() == null || request.redirectUris().isEmpty())) {
            violation(context, "redirectUris", "{app.api.problem.violation.required}");
            valid = false;
        }
        if (methods.contains(ClientAuthenticationMethod.NONE.getValue())
                && authorizationCode
                && !request.requireProofKey()) {
            violation(context, AUTHORIZATION_GRANT_TYPES_FIELD, SELECTION_MESSAGE);
            valid = false;
        }
        if (request.requireProofKey() && !authorizationCode) {
            violation(context, AUTHORIZATION_GRANT_TYPES_FIELD, SELECTION_MESSAGE);
            valid = false;
        }
        return valid;
    }

    private static boolean hasPrivateKeyJwtSettings(AdminClientRequestDTO request) {
        return !isBlank(request.jwkSetUrl())
                && !isBlank(request.tokenEndpointAuthenticationSigningAlgorithm());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static void violation(
            ConstraintValidatorContext context, String field, String messageTemplate) {
        context.buildConstraintViolationWithTemplate(messageTemplate)
                .addPropertyNode(field)
                .addConstraintViolation();
    }
}
