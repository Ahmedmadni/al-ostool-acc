
CREATE POLICY "task attachments read for authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "task attachments insert for authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND owner = auth.uid());

CREATE POLICY "task attachments delete own or admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
