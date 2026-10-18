package io.github.susimsek.kitezh.mcp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Application-specific configuration for the standalone MCP service. */
@ConfigurationProperties(prefix = "app")
public record ApplicationProperties(
        @DefaultValue AuthorizationServer authorizationServer,
        @DefaultValue Security security,
        @DefaultValue Api api,
        @DefaultValue Mcp mcp,
        @DefaultValue Cors cors) {

    @ConstructorBinding
    public ApplicationProperties {
        authorizationServer =
                authorizationServer == null
                        ? new AuthorizationServer("https://kitezh.local")
                        : authorizationServer;
        security =
                security == null
                        ? new Security(
                                "https://kitezh.local/oauth2/jwks",
                                "https://kitezh-mcp.onrender.com/mcp")
                        : security;
        api = api == null ? new Api("http://localhost:9090") : api;
        mcp =
                mcp == null
                        ? new Mcp(
                                "https://kitezh-mcp.onrender.com/mcp",
                                true,
                                new Tools("all", "", "*"))
                        : mcp;
        cors =
                cors == null
                        ? new Cors("app://renderer,http://localhost:6274,http://127.0.0.1:6274")
                        : cors;
    }

    public record AuthorizationServer(@DefaultValue("https://kitezh.local") String issuer) {

        @ConstructorBinding
        public AuthorizationServer {}
    }

    public record Security(
            @DefaultValue("https://kitezh.local/oauth2/jwks") String jwkSetUri,
            @DefaultValue("https://kitezh-mcp.onrender.com/mcp") String audience) {

        @ConstructorBinding
        public Security {}
    }

    public record Api(@DefaultValue("http://localhost:9090") String baseUrl) {

        @ConstructorBinding
        public Api {}
    }

    public record Mcp(
            @DefaultValue("https://kitezh-mcp.onrender.com/mcp") String publicUrl,
            @DefaultValue("true") boolean readOnly,
            @DefaultValue Tools tools) {

        @ConstructorBinding
        public Mcp {
            tools = tools == null ? new Tools("all", "", "*") : tools;
        }
    }

    public record Cors(
            @DefaultValue("app://renderer,http://localhost:6274,http://127.0.0.1:6274")
                    String allowedOrigins) {

        @ConstructorBinding
        public Cors {}
    }

    public record Tools(
            @DefaultValue("all") String toolsets,
            @DefaultValue("") String additionalTools,
            @DefaultValue("*") String allowlist) {

        @ConstructorBinding
        public Tools {}
    }
}
