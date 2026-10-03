package io.github.susimsek.springauthserversamples.service.security;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.PasswordHistoryEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.mapper.PasswordHistoryMapper;
import io.github.susimsek.springauthserversamples.repository.PasswordHistoryRepository;
import io.github.susimsek.springauthserversamples.service.LoginSettingsService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class PasswordPolicyService {

    private final PasswordHistoryRepository passwordHistoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationProperties applicationProperties;
    private final PasswordHistoryMapper passwordHistoryMapper;
    private final LoginSettingsService loginSettingsService;

    public PasswordPolicyService(
            PasswordHistoryRepository passwordHistoryRepository,
            PasswordEncoder passwordEncoder,
            ApplicationProperties applicationProperties) {
        this(passwordHistoryRepository, passwordEncoder, applicationProperties, null, null);
    }

    @Transactional(readOnly = true)
    public void validate(UserEntity user, String rawPassword) {
        validateInternal(user, rawPassword, true);
    }

    @Transactional(readOnly = true)
    public void validateForNewPassword(UserEntity user, String rawPassword) {
        validateInternal(user, rawPassword, true);
    }

    private void validateInternal(
            UserEntity user, String rawPassword, boolean checkCurrentPassword) {
        ApplicationProperties.PasswordPolicy policy = policy();
        validatePasswordRules(rawPassword, policy);
        validateUserRules(user, rawPassword, policy, checkCurrentPassword);
    }

    private void validatePasswordRules(
            String rawPassword, ApplicationProperties.PasswordPolicy policy) {
        if (!StringUtils.hasText(rawPassword)
                || rawPassword.length() < policy.minimumLength()
                || rawPassword.length() > policy.maximumLength()) {
            reject("Password does not meet the configured length policy");
        }
        if (count(rawPassword, Character::isUpperCase) < policy.minimumUppercase()) {
            reject("Password must contain more uppercase characters");
        }
        if (count(rawPassword, Character::isLowerCase) < policy.minimumLowercase()) {
            reject("Password must contain more lowercase characters");
        }
        if (count(rawPassword, Character::isDigit) < policy.minimumDigits()) {
            reject("Password must contain more digits");
        }
        if (count(rawPassword, this::isSpecial) < policy.minimumSpecialCharacters()) {
            reject("Password must contain more special characters");
        }
    }

    private void validateUserRules(
            UserEntity user,
            String rawPassword,
            ApplicationProperties.PasswordPolicy policy,
            boolean checkCurrentPassword) {
        if (policy.rejectUsername() && rawPassword.equalsIgnoreCase(user.getUsername())) {
            reject("Password cannot be the username");
        }
        if (policy.rejectEmail()
                && user.getEmail() != null
                && rawPassword.equalsIgnoreCase(user.getEmail())) {
            reject("Password cannot be the email address");
        }
        if (policy.rejectCommonPasswords()
                && commonPasswords().contains(rawPassword.toLowerCase(Locale.ROOT))) {
            reject("Password is too common");
        }
        rejectIfCurrentPasswordMatches(user, rawPassword, checkCurrentPassword);
        rejectIfPasswordWasUsed(user, rawPassword, policy, checkCurrentPassword);
    }

    private void rejectIfCurrentPasswordMatches(
            UserEntity user, String rawPassword, boolean checkCurrentPassword) {
        if (checkCurrentPassword
                && StringUtils.hasText(user.getPassword())
                && passwordEncoder.matches(rawPassword, user.getPassword())) {
            reject("New password must be different");
        }
    }

    private void rejectIfPasswordWasUsed(
            UserEntity user,
            String rawPassword,
            ApplicationProperties.PasswordPolicy policy,
            boolean checkCurrentPassword) {
        if (checkCurrentPassword && user.getId() != null) {
            passwordHistoryRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                    .limit(policy.historySize())
                    .filter(
                            history ->
                                    passwordEncoder.matches(rawPassword, history.getPasswordHash()))
                    .findFirst()
                    .ifPresent(history -> reject("Password was recently used"));
        }
    }

    @Transactional
    public void recordChange(UserEntity user, String previousPasswordHash) {
        ApplicationProperties.PasswordPolicy policy = policy();
        if (previousPasswordHash != null && policy.historySize() > 0) {
            PasswordHistoryEntity history =
                    passwordHistoryMapper.toEntity(user, previousPasswordHash, Instant.now());
            passwordHistoryRepository.save(history);
        }
        trimHistory(user.getId(), policy.historySize());
    }

    public boolean isExpired(UserEntity user) {
        ApplicationProperties.PasswordPolicy policy = policy();
        return policy.expirationDays() > 0
                && (user.getPasswordChangedAt() == null
                        || user.getPasswordChangedAt()
                                .plus(policy.expirationDays(), ChronoUnit.DAYS)
                                .isBefore(Instant.now()));
    }

    public ApplicationProperties.PasswordPolicy policy() {
        return loginSettingsService == null
                ? applicationProperties.security().passwordPolicy()
                : loginSettingsService.passwordPolicy();
    }

    private void trimHistory(Long userId, int limit) {
        var histories = passwordHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (histories.size() > limit) {
            passwordHistoryRepository.deleteAll(histories.subList(limit, histories.size()));
        }
    }

    private Set<String> commonPasswords() {
        return Arrays.stream(policy().commonPasswords().split(","))
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .filter(StringUtils::hasText)
                .collect(Collectors.toUnmodifiableSet());
    }

    private static long count(String value, Predicate<Character> predicate) {
        return value.chars().mapToObj(character -> (char) character).filter(predicate).count();
    }

    private boolean isSpecial(char character) {
        return !Character.isLetterOrDigit(character) && !Character.isWhitespace(character);
    }

    private static void reject(String message) {
        throw ApiException.badRequest("newPassword", ApiErrorCode.USER_INVALID_PASSWORD, message);
    }
}
