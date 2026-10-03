package io.github.susimsek.springauthserversamples.service.ciba;

import io.github.susimsek.springauthserversamples.config.security.SocialLoginSecretCipher;
import io.github.susimsek.springauthserversamples.repository.CibaAuthenticationRequestRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.admin.CibaPolicyService;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;

final class CibaTestSupport {

    private CibaTestSupport() {}

    static CibaNotificationService notificationService() {
        return new CibaNotificationService((endpoint, authorization, body) -> {}, null);
    }

    static CibaAuthenticationService service(Object... arguments) {
        CibaAuthenticationRequestRepository requestRepository =
                (CibaAuthenticationRequestRepository) arguments[0];
        UserRepository userRepository = (UserRepository) arguments[1];
        CibaNotificationService notificationService =
                arguments.length > 2 && arguments[2] instanceof CibaNotificationService
                        ? (CibaNotificationService) arguments[2]
                        : notificationService();
        CibaPushTokenService pushTokenService =
                arguments.length > 3 && arguments[3] instanceof CibaPushTokenService
                        ? (CibaPushTokenService) arguments[3]
                        : null;
        JwtDecoder jwtDecoder =
                arguments.length > 4 && arguments[4] instanceof JwtDecoder
                        ? (JwtDecoder) arguments[4]
                        : null;
        CibaPolicyService policyService =
                arguments.length > 5 && arguments[5] instanceof CibaPolicyService
                        ? (CibaPolicyService) arguments[5]
                        : null;
        AuthorizationServerSettings settings =
                arguments.length > 6 && arguments[6] instanceof AuthorizationServerSettings
                        ? (AuthorizationServerSettings) arguments[6]
                        : null;
        SocialLoginSecretCipher cipher =
                arguments.length > 7 && arguments[7] instanceof SocialLoginSecretCipher
                        ? (SocialLoginSecretCipher) arguments[7]
                        : null;
        return new CibaAuthenticationService(
                requestRepository,
                userRepository,
                notificationService,
                pushTokenService,
                jwtDecoder,
                policyService,
                settings,
                cipher);
    }
}
