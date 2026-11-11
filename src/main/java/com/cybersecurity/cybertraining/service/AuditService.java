package com.cybersecurity.cybertraining.service;

import com.cybersecurity.cybertraining.dto.Responses.AuditLogView;
import com.cybersecurity.cybertraining.model.AuditLog;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.AuditLogRepository;
import com.cybersecurity.cybertraining.security.ClientIp;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Records security-relevant actions (sign-ins, approvals, role changes,
 * password resets, module changes) in the audit_logs table.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void record(User actor, String action, String entityType, Long entityId, String description) {
        try {
            AuditLog entry = new AuditLog();
            entry.setUser(actor);
            entry.setAction(action);
            entry.setEntityType(entityType);
            entry.setEntityId(entityId);
            entry.setDescription(description == null ? null
                    : description.substring(0, Math.min(description.length(), 2000)));
            entry.setIpAddress(ClientIp.current());
            auditLogRepository.save(entry);
        } catch (RuntimeException exception) {
            // Never let an audit problem break the real action.
            log.warn("Could not write audit log entry {}: {}", action, exception.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<AuditLogView> latest() {
        return auditLogRepository.findTop200ByOrderByCreatedAtDesc().stream()
                .map(entry -> new AuditLogView(
                        entry.getId(),
                        entry.getUser() == null ? "Anonymous"
                                : entry.getUser().getFullName() + " (" + entry.getUser().getEmail() + ")",
                        entry.getAction(),
                        entry.getEntityType(),
                        entry.getEntityId(),
                        entry.getDescription(),
                        entry.getIpAddress(),
                        Dates.text(entry.getCreatedAt())))
                .toList();
    }
}
