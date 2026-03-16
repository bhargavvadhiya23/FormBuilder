package com.sttl.formbuilder.config;

import com.sttl.formbuilder.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.session.HttpSessionEventPublisher;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // Disable CSRF for REST API (frontend uses sessions with SameSite cookies)
                .csrf(csrf -> csrf.disable())

                // Session management — use existing session if present, create one for
                // authenticated requests
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .maximumSessions(5) // max concurrent sessions per user
                )

                // Security context stored in HTTP session
                .securityContext(ctx -> ctx
                        .securityContextRepository(new HttpSessionSecurityContextRepository()))

                // CORS — delegates to WebConfig
                .cors(cors -> cors.configure(http))

                // Route-level access control
                .authorizeHttpRequests(auth -> auth
                        // Public auth endpoints
                        .requestMatchers(
                                "/admin/api/auth/login",
                                "/admin/api/auth/register",
                                "/api/auth/login",
                                "/api/auth/register")
                        .permitAll()

                        // Public form endpoints
                        .requestMatchers(
                                "/publish/**",
                                "/api/files/**")
                        .permitAll()

                        // Define admin-only routes for the new permission system
                        // Using hasAnyRole("ADMIN", "USER") because custom roles are assigned to Users
                        .requestMatchers(
                                "/admin/api/roles/**",
                                "/admin/api/users/**",
                                "/admin/api/approvals/**"
                        ).hasAnyRole("ADMIN", "USER")

                        // All admin routes accessible by either role
                        .requestMatchers("/admin/**").hasAnyRole("ADMIN", "USER")

                        // All other /api/** routes also require authentication (with USER or ADMIN
                        // role)
                        .requestMatchers("/api/**").authenticated()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .anyRequest().authenticated())

                // Disable default form login and basic auth
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())

                // Return 401 JSON instead of redirect for unauthenticated requests
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(401);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Unauthorized - Please log in\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(403);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Forbidden - Insufficient permissions\"}");
                        }));

        return http.build();
    }
}