-- OPTIONAL. You do not need to run this for the application to work.
--
-- These tables were created by older versions of the project (Notification,
-- Schedule, Pathway, PathwayModule and PasswordResetToken entities). The Java
-- classes have been removed and nothing uses the tables any more.
-- Hibernate never deletes tables, so they stay in MySQL until you drop them.
--
-- Run in MySQL Workbench only if you want a tidy database.
-- Make a backup first if the tables contain anything you care about.

USE cybersecuritytraining;

DROP TABLE IF EXISTS pathway_modules;
DROP TABLE IF EXISTS pathways;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS password_reset_tokens;
