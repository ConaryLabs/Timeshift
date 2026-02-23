-- Coverage requirements: min/target/max headcount per shift/classification/day
CREATE TABLE coverage_requirements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),
    shift_template_id UUID NOT NULL REFERENCES shift_templates(id),
    classification_id UUID NOT NULL REFERENCES classifications(id),
    day_of_week       INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    min_headcount     INT NOT NULL DEFAULT 1,
    target_headcount  INT NOT NULL DEFAULT 1,
    max_headcount     INT NOT NULL DEFAULT 1,
    effective_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, shift_template_id, classification_id, day_of_week, effective_date)
);

-- Schedule annotations: notes/alerts/holidays on specific dates
CREATE TABLE schedule_annotations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),
    date              DATE NOT NULL,
    shift_template_id UUID REFERENCES shift_templates(id),
    content           TEXT NOT NULL,
    annotation_type   TEXT NOT NULL CHECK (annotation_type IN ('note', 'alert', 'holiday')),
    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_annotations_org_date ON schedule_annotations (org_id, date);
