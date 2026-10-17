package io.github.susimsek.kitezh.config.aot;

import io.github.susimsek.kitezh.web.admin.validation.AbsoluteUriValidator;
import io.github.susimsek.kitezh.web.admin.validation.AdminClientConfigurationValidator;
import io.github.susimsek.kitezh.web.admin.validation.OptionalAbsoluteUriValidator;
import io.github.susimsek.kitezh.web.admin.validation.OptionalPasswordValidator;
import io.github.susimsek.kitezh.web.admin.validation.OptionalPemValidator;
import io.github.susimsek.kitezh.web.admin.validation.PositiveDurationValidator;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;

public class NativeRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.resources().registerPattern("i18n/**");
        hints.resources().registerPattern("templates/**");
        hints.reflection()
                .registerType(
                        AbsoluteUriValidator.class, MemberCategory.INVOKE_DECLARED_CONSTRUCTORS)
                .registerType(
                        AdminClientConfigurationValidator.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS)
                .registerType(
                        OptionalAbsoluteUriValidator.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS)
                .registerType(
                        OptionalPasswordValidator.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS)
                .registerType(
                        OptionalPemValidator.class, MemberCategory.INVOKE_DECLARED_CONSTRUCTORS)
                .registerType(
                        PositiveDurationValidator.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS);
    }
}
