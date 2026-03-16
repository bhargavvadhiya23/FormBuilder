package com.sttl.formbuilder.config;

import org.kie.api.KieServices;
import org.kie.api.builder.*;
import org.kie.api.io.ResourceType;
import org.kie.api.runtime.KieContainer;
import org.kie.internal.io.ResourceFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Drools 9.x Spring configuration.
 * Builds a base KieContainer from the DRL template on the classpath.
 * DroolsRuleService builds per-form sessions dynamically from DB rules.
 */
@Configuration
public class DroolsConfig {

    @Bean
    public KieServices kieServices() {
        return KieServices.Factory.get();
    }

    @Bean
    public KieContainer kieContainer() {
        KieServices ks = KieServices.Factory.get();
        KieFileSystem kfs = ks.newKieFileSystem();

        // Load the empty base DRL from classpath
        kfs.write(ResourceFactory.newClassPathResource("rules/form_rules.drl"));

        KieBuilder kb = ks.newKieBuilder(kfs);
        kb.buildAll();

        Results results = kb.getResults();
        if (results.hasMessages(Message.Level.ERROR)) {
            throw new IllegalStateException("Drools DRL build errors: " + results.getMessages());
        }

        return ks.newKieContainer(ks.getRepository().getDefaultReleaseId());
    }
}
