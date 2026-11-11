package com.cybersecurity.cybertraining.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A training module (for example "Phishing Awareness").
 * Owned by one MODULE_OWNER account. Learners only see published modules.
 */
@Entity
@Table(name = "modules")
public class Module {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 1000)
    private String description = "";

    // The written training material shown before the quiz.
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content = "";

    @Column(name = "video_url", length = 1000)
    private String videoUrl;

    @Column(name = "video_name")
    private String videoName;

    // File name of an uploaded video stored in the uploads folder (null for linked videos).
    @Column(name = "video_file", length = 300)
    private String videoFile;

    @Column(nullable = false)
    private boolean published = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(name = "passing_score", nullable = false)
    private int passingScore = 70;

    @Column(length = 60)
    private String category;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes = 20;

    @Column(name = "due_date")
    private LocalDate dueDate;

    // Emoji shown on the module card, e.g. 🎣
    @Column(length = 16)
    private String thumbnail;

    // Accent colour in hex, e.g. #7c3aed
    @Column(length = 16)
    private String color;

    @Column(name = "cert_title")
    private String certTitle;

    @Column(name = "cert_subtitle")
    private String certSubtitle;

    @Column(name = "cert_badge", length = 16)
    private String certBadge;

    @Column(name = "cert_accent_color", length = 16)
    private String certAccentColor;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Module() {
    }

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public void setVideoUrl(String videoUrl) {
        this.videoUrl = videoUrl;
    }

    public String getVideoName() {
        return videoName;
    }

    public void setVideoName(String videoName) {
        this.videoName = videoName;
    }

    public String getVideoFile() {
        return videoFile;
    }

    public void setVideoFile(String videoFile) {
        this.videoFile = videoFile;
    }

    public boolean isPublished() {
        return published;
    }

    public void setPublished(boolean published) {
        this.published = published;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public int getPassingScore() {
        return passingScore;
    }

    public void setPassingScore(int passingScore) {
        this.passingScore = passingScore;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public int getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(int durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getThumbnail() {
        return thumbnail;
    }

    public void setThumbnail(String thumbnail) {
        this.thumbnail = thumbnail;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getCertTitle() {
        return certTitle;
    }

    public void setCertTitle(String certTitle) {
        this.certTitle = certTitle;
    }

    public String getCertSubtitle() {
        return certSubtitle;
    }

    public void setCertSubtitle(String certSubtitle) {
        this.certSubtitle = certSubtitle;
    }

    public String getCertBadge() {
        return certBadge;
    }

    public void setCertBadge(String certBadge) {
        this.certBadge = certBadge;
    }

    public String getCertAccentColor() {
        return certAccentColor;
    }

    public void setCertAccentColor(String certAccentColor) {
        this.certAccentColor = certAccentColor;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
