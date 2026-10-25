package io.github.susimsek.kitezh.config.aot;

import jakarta.validation.ConstraintValidator;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.type.classreading.CachingMetadataReaderFactory;
import org.springframework.core.type.classreading.MetadataReaderFactory;
import org.springframework.core.type.filter.AssignableTypeFilter;
import org.springframework.util.ClassUtils;

public class NativeRuntimeHints implements RuntimeHintsRegistrar {

    private static final String CONSTRAINT_VALIDATOR_PACKAGE =
            "io.github.susimsek.kitezh.validation.validator";

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.resources().registerPattern("i18n/**");
        hints.resources().registerPattern("templates/**");
        registerConstraintValidatorHints(hints, classLoader);
    }

    private static void registerConstraintValidatorHints(
            RuntimeHints hints, ClassLoader classLoader) {
        findConstraintValidatorTypes(classLoader)
                .forEach(
                        validatorType ->
                                hints.reflection()
                                        .registerType(
                                                validatorType,
                                                MemberCategory.INVOKE_DECLARED_CONSTRUCTORS));
    }

    static Set<Class<?>> findConstraintValidatorTypes(ClassLoader classLoader) {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        MetadataReaderFactory metadataReaderFactory =
                new CachingMetadataReaderFactory(
                        new PathMatchingResourcePatternResolver(classLoader));
        scanner.setResourceLoader(new PathMatchingResourcePatternResolver(classLoader));
        scanner.setMetadataReaderFactory(metadataReaderFactory);
        scanner.addIncludeFilter(new AssignableTypeFilter(ConstraintValidator.class));

        return scanner.findCandidateComponents(CONSTRAINT_VALIDATOR_PACKAGE).stream()
                .map(
                        candidate -> {
                            try {
                                return ClassUtils.forName(
                                        candidate.getBeanClassName(), classLoader);
                            } catch (ClassNotFoundException exception) {
                                throw new IllegalStateException(
                                        "Could not load constraint validator "
                                                + candidate.getBeanClassName(),
                                        exception);
                            }
                        })
                .collect(Collectors.toUnmodifiableSet());
    }
}
