package io.github.susimsek.kitezh.config.web;

import io.github.susimsek.kitezh.repository.LocalizationMessageOverrideRepository;
import java.text.MessageFormat;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.NoSuchMessageException;

/** Resolves the bundled messages and applies administrator-managed locale overrides. */
@RequiredArgsConstructor
public class DatabaseMessageSource implements MessageSource {

    private final MessageSource bundledMessageSource;
    private final LocalizationMessageOverrideRepository overrideRepository;

    @Override
    public String getMessage(String code, Object[] args, String defaultMessage, Locale locale) {
        String override = override(code, locale);
        return override == null
                ? bundledMessageSource.getMessage(code, args, defaultMessage, locale)
                : format(override, args, locale);
    }

    @Override
    public String getMessage(String code, Object[] args, Locale locale)
            throws NoSuchMessageException {
        String override = override(code, locale);
        return override == null
                ? bundledMessageSource.getMessage(code, args, locale)
                : format(override, args, locale);
    }

    @Override
    public String getMessage(MessageSourceResolvable resolvable, Locale locale)
            throws NoSuchMessageException {
        for (String code : resolvable.getCodes() == null ? new String[0] : resolvable.getCodes()) {
            String override = override(code, locale);
            if (override != null) {
                return format(override, resolvable.getArguments(), locale);
            }
        }
        return bundledMessageSource.getMessage(resolvable, locale);
    }

    private String override(String code, Locale locale) {
        if (code == null || locale == null) {
            return null;
        }
        return overrideRepository
                .findByLocaleAndBundleAndMessageKey(
                        LocaleConfig.normalize(locale).getLanguage(), bundleFor(code), code)
                .map(entity -> entity.getMessageValue())
                .orElse(null);
    }

    private static String bundleFor(String code) {
        return code.startsWith("mail.") ? "email" : "backend";
    }

    private static String format(String value, Object[] args, Locale locale) {
        return args == null || args.length == 0
                ? value
                : new MessageFormat(value, locale).format(args);
    }
}
