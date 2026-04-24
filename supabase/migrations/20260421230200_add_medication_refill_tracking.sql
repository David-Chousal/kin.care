-- Add refill tracking columns to medications
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS quantity_remaining integer,
  ADD COLUMN IF NOT EXISTS refill_threshold integer;

COMMENT ON COLUMN public.medications.quantity_remaining IS 'Current pill/unit count. NULL means tracking disabled.';
COMMENT ON COLUMN public.medications.refill_threshold IS 'Send refill alert when quantity_remaining drops to this value.';
