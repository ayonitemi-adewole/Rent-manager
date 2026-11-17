-- Supabase security advisor (lint 0011): pin search_path on earlier functions so they
-- can't be tricked into resolving objects from another schema.
alter function public.set_updated_at() set search_path = '';
alter function public.dev_send_sms_hook(jsonb) set search_path = '';
