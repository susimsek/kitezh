package io.github.susimsek.kitezh.service.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.service.EmailSettingsService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.time.Duration;
import java.util.Locale;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.MessageSource;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@SuppressWarnings("java:S5778")
class MailServiceTest {

    private final JavaMailSender mailSender = mock(JavaMailSender.class);
    private final MessageSource messageSource = mock(MessageSource.class);
    private final SpringTemplateEngine templateEngine = mock(SpringTemplateEngine.class);

    @Test
    void skipsDeliveryWhenMailIsDisabled() {
        MailService service =
                new MailService(properties(false), mailSender, messageSource, templateEngine, null);

        service.sendPasswordReset(
                "user@example.com", "user", Locale.ENGLISH, "https://example/reset");

        verify(mailSender, never()).createMimeMessage();
        verify(templateEngine, never()).process(any(String.class), any(Context.class));
    }

    @Test
    void rendersAndSendsLocalizedVerificationEmail() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(templateEngine.process(eq("mail/emailVerification"), any(Context.class)))
                .thenReturn("<p>Doğrula</p>");
        when(messageSource.getMessage(
                        "mail.verification.subject", null, Locale.forLanguageTag("tr")))
                .thenReturn("E-posta adresinizi doğrulayın");
        MailService service =
                new MailService(properties(true), mailSender, messageSource, templateEngine, null);

        service.sendEmailVerification(
                "user@example.com",
                "kullanıcı",
                Locale.forLanguageTag("tr"),
                "https://example/verify?token=secret");

        ArgumentCaptor<Context> context = ArgumentCaptor.forClass(Context.class);
        verify(templateEngine).process(eq("mail/emailVerification"), context.capture());
        assertThat(context.getValue().getLocale()).isEqualTo(Locale.forLanguageTag("tr"));
        assertThat(context.getValue().getVariable("username")).isEqualTo("kullanıcı");
        assertThat(context.getValue().getVariable("actionUrl"))
                .isEqualTo("https://example/verify?token=secret");
        assertThat(context.getValue().getVariable("baseUrl")).isEqualTo("https://example.com");

        mimeMessage.saveChanges();
        assertThat(mimeMessage.getAllRecipients())
                .extracting(Object::toString)
                .containsExactly("user@example.com");
        assertThat(mimeMessage.getSubject()).isEqualTo("E-posta adresinizi doğrulayın");
        assertThat(mimeMessage.getContent()).isEqualTo("<p>Doğrula</p>");
        assertThat(mimeMessage.getContentType()).contains("text/html").contains("charset=UTF-8");
        verify(mailSender).send(mimeMessage);
    }

    @Test
    void sendsPasswordResetAndDirectHtmlEmail() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(templateEngine.process(eq("mail/passwordReset"), any(Context.class)))
                .thenReturn("<p>Reset</p>");
        when(messageSource.getMessage("mail.password-reset.subject", null, Locale.ENGLISH))
                .thenReturn("Reset password");
        MailService service =
                new MailService(properties(true), mailSender, messageSource, templateEngine, null);

        service.sendPasswordReset(
                "user@example.com", "user", Locale.ENGLISH, "https://example/reset");
        service.sendEmail("user@example.com", "Subject", "<b>Body</b>", true);

        verify(templateEngine).process(eq("mail/passwordReset"), any(Context.class));
        verify(mailSender, times(2)).send(mimeMessage);
    }

    @Test
    void swallowsDirectEmailDeliveryFailures() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        doThrow(new MailSendException("SMTP unavailable")).when(mailSender).send(mimeMessage);

        new MailService(properties(true), mailSender, messageSource, templateEngine, null)
                .sendEmail("user@example.com", "Subject", "Body", false);

        verify(mailSender).send(mimeMessage);
    }

    @Test
    void sendsSmtpConnectionTestEmail() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(messageSource.getMessage(
                        "mail.test.subject", null, "SMTP connection test", Locale.ENGLISH))
                .thenReturn("SMTP connection test");
        when(messageSource.getMessage(
                        "mail.test.text", null, "This is a test email.", Locale.ENGLISH))
                .thenReturn("This is a test email.");
        MailService service =
                new MailService(properties(false), mailSender, messageSource, templateEngine, null);

        service.testConnection(
                new EmailSettingsService.EmailConfiguration(
                        false,
                        "Kitezh <no-reply@example.com>",
                        "https://example.com",
                        "localhost",
                        1025,
                        null,
                        null,
                        false,
                        false,
                        false),
                "admin@example.com",
                Locale.ENGLISH);

        mimeMessage.saveChanges();
        assertThat(mimeMessage.getAllRecipients())
                .extracting(Object::toString)
                .containsExactly("admin@example.com");
        assertThat(mimeMessage.getSubject()).isEqualTo("SMTP connection test");
        assertThat(mimeMessage.getContent()).isEqualTo("This is a test email.");
        verify(mailSender).send(mimeMessage);
    }

    @Test
    void reportsSmtpConnectionFailure() {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(messageSource.getMessage(
                        "mail.test.subject", null, "SMTP connection test", Locale.ENGLISH))
                .thenReturn("SMTP connection test");
        when(messageSource.getMessage(
                        "mail.test.text", null, "This is a test email.", Locale.ENGLISH))
                .thenReturn("This is a test email.");
        doThrow(new MailSendException("SMTP unavailable")).when(mailSender).send(mimeMessage);
        MailService service =
                new MailService(properties(false), mailSender, messageSource, templateEngine, null);

        assertThatThrownBy(
                        () ->
                                service.testConnection(
                                        new EmailSettingsService.EmailConfiguration(
                                                false,
                                                "Kitezh" + " <no-reply@example.com>",
                                                "https://example.com",
                                                "localhost",
                                                1025,
                                                null,
                                                null,
                                                false,
                                                false,
                                                false),
                                        "admin@example.com",
                                        Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.EMAIL_TEST_FAILED);
    }

    @Test
    void buildsAnOverrideSmtpSenderFromEmailSettings() {
        EmailSettingsService emailSettingsService = mock(EmailSettingsService.class);
        EmailSettingsService.EmailConfiguration configuration =
                new EmailSettingsService.EmailConfiguration(
                        true,
                        "no-reply@example.com",
                        "https://example.com",
                        "smtp.example.com",
                        2525,
                        "smtp-user",
                        "smtp-password",
                        true,
                        true,
                        false);
        MailService service =
                new MailService(
                        properties(true),
                        mailSender,
                        messageSource,
                        templateEngine,
                        emailSettingsService);

        JavaMailSender sender =
                ReflectionTestUtils.invokeMethod(service, "configuredSender", configuration);

        assertThat(sender).isInstanceOf(JavaMailSenderImpl.class);
        assertThat(((JavaMailSenderImpl) sender).getHost()).isEqualTo("smtp.example.com");
        assertThat(((JavaMailSenderImpl) sender).getPort()).isEqualTo(2525);
        assertThat(((JavaMailSenderImpl) sender).getUsername()).isEqualTo("smtp-user");
    }

    private static ApplicationProperties properties(boolean enabled) {
        return new ApplicationProperties(
                new ApplicationProperties.Cache(
                        new ApplicationProperties.Caffeine(Duration.ofHours(1), 10, 100)),
                new ApplicationProperties.Session("0 * * * * *"),
                new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                new ApplicationProperties.Mail(
                        enabled, "Kitezh <no-reply@example.com>", "https://example.com"));
    }
}
