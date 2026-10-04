package io.github.susimsek.springauthserversamples.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.springauthserversamples.domain.LoginSettingsEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLoginSettingsRequestDTO;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

class LoginSettingsMapperTest {

    private final LoginSettingsMapper mapper = Mappers.getMapper(LoginSettingsMapper.class);

    @Test
    void mapsEntityToPublicAndAdminViews() {
        LoginSettingsEntity entity = entity();

        assertThat(mapper.toPublicDTO(entity).userRegistration()).isTrue();
        assertThat(mapper.toAdminDTO(entity).otpAlgorithm()).isEqualTo("SHA256");
        assertThat(mapper.toAdminDTO(entity).recoveryCodeWarningThreshold()).isEqualTo(3);
        assertThat(mapper.toAdminDTO(entity).githubLoginEnabled()).isFalse();
    }

    @Test
    void updatesAndNormalizesOtpSettings() {
        LoginSettingsEntity entity = new LoginSettingsEntity();

        mapper.update(request(), entity);

        assertThat(entity.isUserRegistrationEnabled()).isTrue();
        assertThat(entity.getOtpIssuer()).isEqualTo("Issuer");
        assertThat(entity.getOtpAlgorithm()).isEqualTo("SHA512");
        assertThat(entity.getRecoveryCodeWarningThreshold()).isEqualTo(4);
        assertThat(entity.getWebAuthnRpName()).isEqualTo("Kitezh");
        assertThat(entity.getWebAuthnResidentKey()).isEqualTo("preferred");
        assertThat(entity.getWebAuthnPasswordlessUserVerification()).isEqualTo("required");
    }

    private static LoginSettingsEntity entity() {
        LoginSettingsEntity entity = new LoginSettingsEntity();
        entity.setUserRegistrationEnabled(true);
        entity.setForgotPasswordEnabled(true);
        entity.setRememberMeEnabled(false);
        entity.setLoginWithEmail(true);
        entity.setVerifyEmail(true);
        entity.setGoogleLoginEnabled(true);
        entity.setGithubLoginEnabled(false);
        entity.setLinkedinLoginEnabled(true);
        entity.setOtpAlgorithm("SHA256");
        entity.setRecoveryCodeWarningThreshold(3);
        return entity;
    }

    private static AdminLoginSettingsRequestDTO request() {
        return new AdminLoginSettingsRequestDTO(
                true,
                true,
                false,
                true,
                true,
                30,
                12,
                true,
                5,
                3,
                true,
                true,
                " Issuer ",
                " sha512 ",
                6,
                30,
                1,
                false,
                true,
                4);
    }
}
