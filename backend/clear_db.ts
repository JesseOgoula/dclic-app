import { store, supabase } from './src/services/store';

async function clear() {
  console.log('Clearing progress...');
  await supabase.from('progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Clearing activities...');
  await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Done');
}

clear();
