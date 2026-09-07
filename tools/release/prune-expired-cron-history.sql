-- Manual catch-up for the deployed seven-day cron history retention policy.
-- This deletes only completed, expired operational logs, never customer tables.
-- Run one batch at a time and verify completion before repeating after a timeout.
-- Retain unfinished runs and every run completed within the last seven days.
WITH expired AS MATERIALIZED (
  SELECT runid
  FROM cron.job_run_details
  WHERE end_time < now() - interval '7 days'
  ORDER BY runid
  LIMIT 2000
), removed AS (
  DELETE FROM cron.job_run_details AS history
  USING expired
  WHERE history.runid = expired.runid
    AND history.end_time < now() - interval '7 days'
  RETURNING history.runid
)
SELECT count(*) AS expired_logs_removed,
       min(runid) AS first_removed_id,
       max(runid) AS last_removed_id
FROM removed;
