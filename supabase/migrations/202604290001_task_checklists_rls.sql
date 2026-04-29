
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can read task checklists in their organization"
  ON public.task_checklists FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );


CREATE POLICY "Users can insert task checklists in their organization"
  ON public.task_checklists FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update task checklists in their organization"
  ON public.task_checklists FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete checklists they created or in their organization
CREATE POLICY "Users can delete task checklists in their organization"
  ON public.task_checklists FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Enable RLS on task_checklist_items table
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read checklist items for tasks in their organization
CREATE POLICY "Users can read task checklist items in their organization"
  ON public.task_checklist_items FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert checklist items for tasks in their organization
CREATE POLICY "Users can insert task checklist items in their organization"
  ON public.task_checklist_items FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update checklist items in their organization
CREATE POLICY "Users can update task checklist items in their organization"
  ON public.task_checklist_items FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete checklist items in their organization
CREATE POLICY "Users can delete task checklist items in their organization"
  ON public.task_checklist_items FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

create table public.stock_locations (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  code text null,
  description text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  image_url text null,
  constraint stock_locations_pkey primary key (id),
  constraint stock_locations_org_name_unique unique (organization_id, name),
  constraint stock_locations_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;