insert into admin_allowlist (email) values
  ('letsrunteam@gmail.com'),
  ('risewithharsh@gmail.com')
on conflict (email) do nothing;
