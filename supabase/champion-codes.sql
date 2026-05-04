insert into public.champion_card_codes (promotion_id, code, active)
values (
  '1a0dfde0-cbc5-4323-9c1d-589f1be5f12a',
  'LOL-CHAMP-001',
  true
);

select id, promotion_id, code, active, created_at
from public.champion_card_codes
order by created_at desc;
