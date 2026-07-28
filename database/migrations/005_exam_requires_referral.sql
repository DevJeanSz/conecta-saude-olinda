ALTER TABLE exam_types ADD COLUMN requires_referral BOOLEAN DEFAULT TRUE;
ALTER TABLE exams ADD COLUMN referral_attachment TEXT;
