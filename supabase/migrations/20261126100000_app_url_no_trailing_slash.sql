-- Links in reminders are built as app_url || '/t/' || token, so a trailing slash on app_url
-- gave "https://…app//t/…". Strip it now and whenever app_url is saved.
create or replace function public.app_config_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.key = 'app_url' then
    new.value := rtrim(trim(new.value), '/');
  end if;
  return new;
end;
$$;

create trigger app_config_normalize before insert or update on public.app_config
  for each row execute function public.app_config_normalize();

update public.app_config set value = value where key = 'app_url';
