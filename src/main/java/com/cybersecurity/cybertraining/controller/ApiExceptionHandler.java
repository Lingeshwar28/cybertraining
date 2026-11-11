package com.cybersecurity.cybertraining.controller;

import com.cybersecurity.cybertraining.dto.Responses.MessageResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

/**
 * Turns errors into a simple JSON body {"message": "..."} that index.html can show
 * in its red error boxes and toasts. Internal details are never sent to the browser.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /** Our own validation messages (written for the user). */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<MessageResponse> badRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new MessageResponse(exception.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<MessageResponse> unreadable(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(new MessageResponse("The request was not in the expected format."));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<MessageResponse> tooLarge(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(new MessageResponse("That file is too large. The maximum video size is 200 MB."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<MessageResponse> conflict(DataIntegrityViolationException exception) {
        log.warn("Database constraint problem: {}", exception.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new MessageResponse("That change conflicts with existing data."));
    }

    /** ResponseStatusException and Spring's own web errors (404, 405, ...). */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<MessageResponse> other(Exception exception) {
        if (exception instanceof ResponseStatusException statusException) {
            String reason = statusException.getReason() != null ? statusException.getReason() : "Request failed.";
            return ResponseEntity.status(statusException.getStatusCode()).body(new MessageResponse(reason));
        }

        if (exception instanceof ErrorResponse errorResponse) {
            HttpStatusCode status = errorResponse.getStatusCode();
            return ResponseEntity.status(status).body(new MessageResponse(
                    status.value() == 404 ? "Not found." : "Request failed (" + status.value() + ")."));
        }

        log.error("Unexpected error", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Something went wrong on the server. Please try again."));
    }
}
