package io.github.susimsek.kitezh.config.aot;

import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;

public class NativeRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.resources().registerPattern("i18n/**");
        hints.resources().registerPattern("templates/**");
        hints.resources().registerPattern("default-config.xml");
        hints.resources().registerPattern("schema-config.xml");
        hints.resources().registerPattern("encryption-config.xml");
        hints.resources().registerPattern("signature-config.xml");
        hints.resources().registerPattern("saml*-config.xml");
        hints.resources().registerPattern("soap11-config.xml");
        hints.resources().registerPattern("wsaddressing-config.xml");
        hints.resources().registerPattern("wsfed11-protocol-config.xml");
        hints.resources().registerPattern("wspolicy-config.xml");
        hints.resources().registerPattern("wssecurity-config.xml");
        hints.resources().registerPattern("wstrust-config.xml");
    }
}
