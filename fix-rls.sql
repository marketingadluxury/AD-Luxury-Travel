DROP POLICY IF EXISTS "Allow authenticated access to tours" ON tours;
CREATE POLICY "Allow authenticated access to tours" ON tours FOR ALL TO authenticated USING (true) WITH CHECK (true);
