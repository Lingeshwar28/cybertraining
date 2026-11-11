package com.cybersecurity.cybertraining.repository;

import com.cybersecurity.cybertraining.model.PasswordResetRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PasswordResetRequestRepository extends JpaRepository<PasswordResetRequest, Long> {

    List<PasswordResetRequest> findAllByOrderByRequestedAtDesc();

    List<PasswordResetRequest> findByUserIdAndStatus(Long userId, String status);
}
