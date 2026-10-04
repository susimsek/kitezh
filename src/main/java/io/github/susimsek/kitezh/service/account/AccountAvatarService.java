package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.AccountAvatarDTO;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAvatarService;
import io.github.susimsek.kitezh.service.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class AccountAvatarService {

    private final UserRepository userRepository;
    private final UserAvatarRepository userAvatarRepository;
    private final AdminAvatarService adminAvatarService;

    @Transactional(readOnly = true)
    public AccountAvatarDTO avatar(String username) {
        UserEntity user = requireUser(username);
        return userAvatarRepository
                .findVersionByUserId(user.getId())
                .map(
                        avatar ->
                                new AccountAvatarDTO(
                                        "/avatars/"
                                                + avatar.getPublicId()
                                                + "?v="
                                                + avatar.getUpdatedAt().toEpochMilli()))
                .orElseGet(() -> new AccountAvatarDTO(user.getPictureUrl()));
    }

    @Transactional
    public AccountAvatarDTO updateAvatar(String username, MultipartFile file) {
        UserEntity user = requireUser(username);
        var avatar = adminAvatarService.updateAvatar(user.getId(), file, username);
        return new AccountAvatarDTO(avatar.avatarUrl());
    }

    @Transactional
    public void deleteAvatar(String username) {
        UserEntity user = requireUser(username);
        adminAvatarService.deleteAvatar(user.getId(), username);
    }

    private UserEntity requireUser(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
