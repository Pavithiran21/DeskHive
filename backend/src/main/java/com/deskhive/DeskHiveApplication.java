package com.deskhive;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

// UserDetailsServiceAutoConfiguration is excluded because logins use our own JWT filter; without
// the exclusion Spring Boot would create an in-memory user and log a generated password.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
@EnableScheduling
@EnableAsync
public class DeskHiveApplication {

    public static void main(String[] args) {
        // The app runs in UTC whatever the machine's zone. Hibernate (jdbc.time_zone=UTC) converts a LocalTime
        // through the JVM's default zone, so on a machine in IST the opening time 08:00 was stored as 02:30, and
        // hours before 05:30 wrapped past midnight and broke the opens_at < closes_at check. In UTC, office-local
        // times are stored exactly as the Admin set them. Instants were always UTC and are not affected.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(DeskHiveApplication.class, args);
    }
}
