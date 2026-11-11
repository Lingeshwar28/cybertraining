package com.cybersecurity.cybertraining.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;

/** Small helpers so dates are always sent to the browser as ISO text. */
public final class Dates {

    private Dates() {
    }

    public static String text(LocalDateTime value) {
        return value == null ? null : value.truncatedTo(ChronoUnit.SECONDS).toString();
    }

    public static String text(LocalDate value) {
        return value == null ? null : value.toString();
    }

    /** Parses "2026-12-01" (or "2026-12-01T..."). Blank means "no date". */
    public static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            String trimmed = value.trim();
            return LocalDate.parse(trimmed.length() > 10 ? trimmed.substring(0, 10) : trimmed);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("Due date must be a valid date (YYYY-MM-DD).");
        }
    }
}
