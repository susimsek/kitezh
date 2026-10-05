package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorizationConsentRepository;
import io.github.susimsek.kitezh.repository.UserActionTokenRepository;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.HashSet;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final AuthorizationConsentRepository authorizationConsentRepository;
    private final UserActionTokenRepository userActionTokenRepository;
    private final UserAvatarRepository userAvatarRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuditEventService auditEventService;

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void deleteAccount(String username, String currentPassword) {
        UserEntity user =
                userRepository
                        .findByUsername(username)
                        .orElseThrow(() -> ApiException.notFound("User not found"));
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw ApiException.badRequest(
                    "currentPassword",
                    ApiErrorCode.INVALID_CURRENT_PASSWORD,
                    "Current password is incorrect");
        }

        userAccessInvalidationService.invalidate(username);
        authorizationConsentRepository.deleteByIdPrincipalName(username);
        userActionTokenRepository.deleteByUserId(user.getId());
        userAvatarRepository.findById(user.getId()).ifPresent(userAvatarRepository::delete);
        user.setAuthorities(new HashSet<>());
        user.setGroups(new HashSet<>());
        Long userId = user.getId();
        userRepository.delete(user);
        auditEventService.record("user.account.deleted", "user", userId.toString());
    }
}
