ALTER TABLE units
ADD COLUMN tolerance_minutes integer DEFAULT 15,
ADD COLUMN auto_cancel_no_show boolean DEFAULT true;
