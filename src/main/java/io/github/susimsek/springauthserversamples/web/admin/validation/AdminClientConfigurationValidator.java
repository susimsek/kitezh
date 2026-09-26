package io.github.susimsek.springauthserversamples.web.admin.validation;

import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
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
                    ClientAuthenticationMethod.NONE.getValue());
    private static final Set<String> ALLOWED_GRANTS =
            Set.of(
                    AuthorizationGrantType.AUTHORIZATION_CODE.getValue(),
                    AuthorizationGrantType.REFRESH_TOKEN.getValue(),
                    AuthorizationGrantType.CLIENT_CREDENTIALS.getValue(),
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
        boolean valid = true;
        context.disableDefaultConstraintViolation();

        if (!ALLOWED_METHODS.containsAll(methods)
                || (methods.contains(ClientAuthenticationMethod.NONE.getValue())
                        && methods.size() > 1)) {
            valid = false;
            violation(context, CLIENT_AUTHENTICATION_METHODS_FIELD, SELECTION_MESSAGE);
        }
        if (!ALLOWED_GRANTS.containsAll(grants)
                || (methods.contains(ClientAuthenticationMethod.NONE.getValue())
                        && grants.contains(AuthorizationGrantType.CLIENT_CREDENTIALS.getValue()))) {
            valid = false;
            violation(context, AUTHORIZATION_GRANT_TYPES_FIELD, SELECTION_MESSAGE);
        }

        boolean authorizationCode =
                grants.contains(AuthorizationGrantType.AUTHORIZATION_CODE.getValue());
        if (authorizationCode
                && (request.redirectUris() == null || request.redirectUris().isEmpty())) {
            valid = false;
            violation(context, "redirectUris", "{app.api.problem.violation.required}");
        }
        if (methods.contains(ClientAuthenticationMethod.NONE.getValue())
                && authorizationCode
                && !request.requireProofKey()) {
            valid = false;
            violation(context, AUTHORIZATION_GRANT_TYPES_FIELD, SELECTION_MESSAGE);
        }
        if (request.requireProofKey() && !authorizationCode) {
            valid = false;
            violation(context, AUTHORIZATION_GRANT_TYPES_FIELD, SELECTION_MESSAGE);
        }
        return valid;
    }

    private static void violation(
            ConstraintValidatorContext context, String field, String messageTemplate) {
        context.buildConstraintViolationWithTemplate(messageTemplate)
                .addPropertyNode(field)
                .addConstraintViolation();
    }
}
