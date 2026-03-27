DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_id_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role
      FROM public.user_roles
      WHERE user_id = _user_id
      ORDER BY CASE WHEN role = 'admin'::public.app_role THEN 0 ELSE 1 END, id
      LIMIT 1
    ),
    'user'::public.app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

CREATE POLICY "Authenticated users can view leads"
ON public.leads
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    created_by IS NULL
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Authenticated users can update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    created_by IS NULL
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Admins can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated can view cache" ON public.email_verification_cache;
DROP POLICY IF EXISTS "Authenticated can insert cache" ON public.email_verification_cache;
DROP POLICY IF EXISTS "Authenticated can update cache" ON public.email_verification_cache;

CREATE POLICY "Authenticated can view cache"
ON public.email_verification_cache
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert cache"
ON public.email_verification_cache
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update cache"
ON public.email_verification_cache
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_profiles_updated_at'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_leads_updated_at'
      AND tgrelid = 'public.leads'::regclass
  ) THEN
    CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;