
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can delete profiles" ON profiles;

CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
    OR id = auth.uid()
  );


CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());


CREATE POLICY "Admins can update profiles in their organization"
  ON profiles FOR UPDATE
  USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
    AND (
      (auth.jwt() ->> 'primary_role')::text IN ('admin', 'manager', 'super_admin')
      OR (auth.jwt() ->> 'role')::text IN ('admin', 'manager', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete profiles in their organization"
  ON profiles FOR DELETE
  USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
    AND (
      (auth.jwt() ->> 'primary_role')::text IN ('admin', 'manager', 'super_admin')
      OR (auth.jwt() ->> 'role')::text IN ('admin', 'manager', 'super_admin')
    )
    AND id != auth.uid() 
  );

CREATE POLICY "Service role can manage all profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');
