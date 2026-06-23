import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]/g, '').replace(/['"]$/g, '');
  }
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(url, key);

const { data, error } = await supabase.from('attendance').select('*').limit(1);
if (error) {
  console.error(error);
} else {
  console.log(Object.keys(data[0] || {}));
}
process.exit(0);
