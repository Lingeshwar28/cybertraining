package com.cybersecurity.cybertraining.service;

import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public DatabaseUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {

        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() ->
                        new UsernameNotFoundException("User not found")
                );

        boolean accountApproved =
                "APPROVED".equalsIgnoreCase(user.getApprovalStatus());

        boolean accountCanLogin =
                user.isEnabled() && accountApproved;

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                accountCanLogin,
                true,
                true,
                true,
                Collections.singletonList(
                        new SimpleGrantedAuthority(
                                "ROLE_" + user.getRole()
                        )
                )
        );
    }
}