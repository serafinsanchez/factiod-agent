-- Create the 'projects' storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('projects', 'projects', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the 'projects' bucket
-- Allow public read access
CREATE POLICY "Public read access for projects bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'projects');

-- Allow authenticated uploads (or service role)
CREATE POLICY "Authenticated users can upload to projects bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'projects');

-- Allow authenticated updates
CREATE POLICY "Authenticated users can update projects bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'projects')
WITH CHECK (bucket_id = 'projects');

-- Allow authenticated deletes
CREATE POLICY "Authenticated users can delete from projects bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'projects');

