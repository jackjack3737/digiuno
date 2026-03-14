-- Aggiorna la vista classifica: aggiunge active_start_time per cronometri corretti in classifica.
-- Copia tutto, incolla in Supabase → SQL Editor → Run.

CREATE OR REPLACE VIEW public.digiuno_leaderboard AS
SELECT t.id, t.username, t.created_at, t.total_hours, t.is_fasting, t.active_start_time
FROM (
  SELECT
    u.id,
    u.username,
    u.created_at,
    ROUND(
      CAST(COALESCE((
        SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(f.end_time, NOW()) - f.start_time)) / 3600.0)
        FROM public.digiuno_fast_sessions f
        WHERE f.user_id = u.id
          AND f.start_time >= COALESCE((SELECT reset_at FROM public.leaderboard_reset WHERE id = 1 LIMIT 1), '1970-01-01'::timestamptz)
      ), 0) AS NUMERIC), 2
    ) AS total_hours,
    EXISTS(
      SELECT 1 FROM public.digiuno_fast_sessions f2
      WHERE f2.user_id = u.id AND f2.end_time IS NULL
    ) AS is_fasting,
    (SELECT f3.start_time FROM public.digiuno_fast_sessions f3 WHERE f3.user_id = u.id AND f3.end_time IS NULL LIMIT 1) AS active_start_time
  FROM public.digiuno_users u
) t
WHERE t.total_hours > 0 OR t.is_fasting;
