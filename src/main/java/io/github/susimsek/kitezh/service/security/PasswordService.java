package io.github.susimsek.kitezh.service.security;

import io.github.susimsek.kitezh.domain.UserEntity;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PasswordService {

    private final PasswordPolicyService passwordPolicyService;
    private final PasswordEncoder passwordEncoder;

    public boolean matchesCurrentPassword(String rawPassword, UserEntity user) {
        return rawPassword != null
                && user.getPassword() != null
                && passwordEncoder.matches(rawPassword, user.getPassword());
    }

    @Transactional
    public void setInitialPassword(UserEntity user, String rawPassword) {
        passwordPolicyService.validateForNewPassword(user, rawPassword);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(false);
        user.setTemporaryPassword(false);
    }

    @Transactional
    public void setTemporaryPassword(UserEntity user, String rawPassword) {
        passwordPolicyService.validateForNewPassword(user, rawPassword);
        String previousHash = user.getPassword();
        passwordPolicyService.recordChange(user, previousHash);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(true);
        user.setTemporaryPassword(true);
    }

    @Transactional
    public void changePassword(UserEntity user, String rawPassword) {
        passwordPolicyService.validate(user, rawPassword);
        passwordPolicyService.recordChange(user, user.getPassword());
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(false);
        user.setTemporaryPassword(false);
    }
}
