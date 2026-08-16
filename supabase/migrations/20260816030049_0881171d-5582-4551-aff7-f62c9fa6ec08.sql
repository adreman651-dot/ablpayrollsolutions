
DROP POLICY IF EXISTS "Employee photos readable by authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Auth manage selfies" ON storage.objects;

-- Employee photos: staff (admin/HR/payroll officer) or the employee's own photo folder
CREATE POLICY "Employee photos readable by staff or owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (
    public.is_admin() OR public.is_hr() OR public.is_payroll_officer()
    OR (storage.foldername(name))[1] = public.get_my_employee_id()::text
    OR name LIKE (public.get_my_employee_id()::text || '.%')
  )
);

-- Selfies: staff can read all; employees can only read their own folder
CREATE POLICY "Selfies readable by staff or owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'selfies'
  AND (
    public.is_admin() OR public.is_hr() OR public.is_payroll_officer()
    OR (storage.foldername(name))[1] = public.get_my_employee_id()::text
  )
);

-- Selfie uploads: only into the caller's own employee folder, or by staff
CREATE POLICY "Selfies uploadable by staff or owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'selfies'
  AND (
    public.is_admin() OR public.is_hr() OR public.is_payroll_officer()
    OR (storage.foldername(name))[1] = public.get_my_employee_id()::text
  )
);

-- Only admin/HR may modify or remove selfie evidence
CREATE POLICY "Selfies updatable by admin hr"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'selfies' AND (public.is_admin() OR public.is_hr()));

CREATE POLICY "Selfies deletable by admin hr"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'selfies' AND (public.is_admin() OR public.is_hr()));
