
UPDATE public.meetings
SET livekit_room_name = 'meeting:' || id::text
WHERE livekit_room_name IS NULL OR btrim(livekit_room_name) = '';

UPDATE public.meetings
SET scheduled_for = scheduled_start
WHERE scheduled_for IS NULL
  AND scheduled_start IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_meeting_derived_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS NOT NULL THEN
    NEW.livekit_room_name := 'meeting:' || NEW.id::text;
  END IF;

  IF NEW.scheduled_start IS NOT NULL
     AND (NEW.scheduled_for IS NULL OR NEW.scheduled_for IS DISTINCT FROM NEW.scheduled_start) THEN
    NEW.scheduled_for := NEW.scheduled_start;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetings_sync_derived_fields ON public.meetings;

CREATE TRIGGER trg_meetings_sync_derived_fields
  BEFORE INSERT OR UPDATE OF scheduled_start, scheduled_for, livekit_room_name
  ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_meeting_derived_fields();

ALTER TABLE public.meeting_signals
  DROP CONSTRAINT IF EXISTS meeting_signals_signal_type_check;

ALTER TABLE public.meeting_signals
  ADD CONSTRAINT meeting_signals_signal_type_check
  CHECK (
    signal_type = ANY (
      ARRAY[
        'offer'::text,
        'answer'::text,
        'ice-candidate'::text,
        'request_camera_on'::text,
        'request_microphone_on'::text,
        'camera_request_accepted'::text,
        'camera_request_declined'::text,
        'microphone_request_accepted'::text,
        'microphone_request_declined'::text,
        'force_camera_off'::text,
        'force_mute'::text,
        'remove_participant'::text
      ]
    )
  );

COMMENT ON CONSTRAINT meeting_signals_signal_type_check ON public.meeting_signals IS
  'LiveKit moderation and legacy WebRTC signal types used by the meeting room UI.';


DROP INDEX IF EXISTS public.idx_meeting_signals_meeting_id;
