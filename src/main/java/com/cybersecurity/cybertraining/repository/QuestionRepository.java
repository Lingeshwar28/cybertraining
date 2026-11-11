package com.cybersecurity.cybertraining.repository;

import com.cybersecurity.cybertraining.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {

    List<Question> findByModuleIdAndActiveTrueOrderByQuestionOrderAsc(Long moduleId);

    List<Question> findByModuleIdOrderByQuestionOrderAsc(Long moduleId);

    long countByModuleIdAndActiveTrue(Long moduleId);
}
