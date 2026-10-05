package io.github.susimsek.kitezh.service.mail;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.service.EmailSettingsService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

/** Sends localized HTML email without coupling delivery to an HTTP request transaction. */
@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S4449")
public class MailService {

    private static final Logger LOG = LoggerFactory.getLogger(MailService.class);
    private static final String VERIFICATION_TEMPLATE = "mail/emailVerification";
    private static final String PASSWORD_RESET_TEMPLATE = "mail/passwordReset";

    private final ApplicationProperties applicationProperties;
    private final JavaMailSender mailSender;
    private final MessageSource messageSource;
    private final SpringTemplateEngine templateEngine;
    private final EmailSettingsService emailSettingsService;

    @Async
    public void sendEmailVerification(
            String recipient, String username, Locale locale, String verificationUrl) {
        sendFromTemplate(
                recipient,
                username,
                locale,
                verificationUrl,
                VERIFICATION_TEMPLATE,
                "mail.verification.subject");
    }

    @Async
    public void sendPasswordReset(
            String recipient, String username, Locale locale, String resetUrl) {
        sendFromTemplate(
                recipient,
                username,
                locale,
                resetUrl,
                PASSWORD_RESET_TEMPLATE,
                "mail.password-reset.subject");
    }

    @Async
    public void sendEmail(String recipient, String subject, String content, boolean html) {
        sendEmailSync(recipient, subject, content, html);
    }

    public void testConnection(
            EmailSettingsService.EmailConfiguration configuration,
            String recipient,
            Locale locale) {
        JavaMailSender sender = configuredSender(configuration);
        try {
            MimeMessage mimeMessage = sender.createMimeMessage();
            MimeMessageHelper message =
                    new MimeMessageHelper(mimeMessage, false, StandardCharsets.UTF_8.name());
            message.setTo(recipient);
            message.setFrom(configuration.fromAddress());
            message.setSubject(
                    messageSource.getMessage(
                            "mail.test.subject", null, "SMTP connection test", locale));
            message.setText(
                    messageSource.getMessage(
                            "mail.test.text", null, "This is a test email.", locale),
                    false);
            sender.send(mimeMessage);
        } catch (MailException | MessagingException exception) {
            LOG.warn("SMTP connection test failed", exception);
            throw ApiException.badRequest(
                    ApiErrorCode.EMAIL_TEST_FAILED, "SMTP connection test failed");
        }
    }

    private void sendFromTemplate(
            String recipient,
            String username,
            Locale locale,
            String actionUrl,
            String templateName,
            String subjectKey) {
        EmailSettingsService.EmailConfiguration configuration = configuration();
        if (!configuration.enabled()) {
            LOG.debug("Email delivery is disabled; skipping message to '{}'", recipient);
            return;
        }

        Context context = new Context(locale);
        context.setVariable("username", username);
        context.setVariable("actionUrl", actionUrl);
        context.setVariable("baseUrl", configuration.baseUrl());

        String content = templateEngine.process(templateName, context);
        String subject = messageSource.getMessage(subjectKey, null, locale);
        sendEmailSync(recipient, subject, content, true);
    }

    private void sendEmailSync(String recipient, String subject, String content, boolean html) {
        EmailSettingsService.EmailConfiguration configuration = configuration();
        if (!configuration.enabled()) {
            LOG.debug("Email delivery is disabled; skipping message to '{}'", recipient);
            return;
        }

        JavaMailSender sender = configuredSender(configuration);
        MimeMessage mimeMessage = sender.createMimeMessage();
        try {
            MimeMessageHelper message =
                    new MimeMessageHelper(mimeMessage, false, StandardCharsets.UTF_8.name());
            message.setTo(recipient);
            message.setFrom(configuration.fromAddress());
            message.setSubject(subject);
            message.setText(content, html);
            sender.send(mimeMessage);
            LOG.debug("Email sent to '{}'", recipient);
        } catch (MailException | MessagingException exception) {
            LOG.warn("Email could not be sent to '{}'", recipient, exception);
        }
    }

    private EmailSettingsService.EmailConfiguration configuration() {
        return emailSettingsService == null
                ? new EmailSettingsService.EmailConfiguration(
                        applicationProperties.mail().enabled(),
                        applicationProperties.mail().from(),
                        applicationProperties.mail().baseUrl(),
                        null,
                        0,
                        null,
                        null,
                        false,
                        false,
                        false)
                : emailSettingsService.current();
    }

    private JavaMailSender configuredSender(EmailSettingsService.EmailConfiguration configuration) {
        if (emailSettingsService == null || configuration.host() == null) {
            return mailSender;
        }
        org.springframework.mail.javamail.JavaMailSenderImpl sender =
                new org.springframework.mail.javamail.JavaMailSenderImpl();
        sender.setHost(configuration.host());
        sender.setPort(configuration.port());
        sender.setUsername(configuration.username());
        sender.setPassword(configuration.password());
        java.util.Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", configuration.smtpAuth());
        props.put("mail.smtp.starttls.enable", configuration.starttls());
        props.put("mail.smtp.ssl.enable", configuration.ssl());
        return sender;
    }
}
