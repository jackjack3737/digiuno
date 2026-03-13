-- ========== SQL COMPLETO: copia tutto, incolla in Supabase SQL Editor, Run ==========

-- 0) Se la tabella esiste già con tipi sbagliati, eliminala così si ricrea corretta
DROP TABLE IF EXISTS public.sintomo_prodotto;

-- 1) Crea la tabella di associazione (sintomi_rimedi_digiuno.id = bigint, partner_products.id = uuid)
CREATE TABLE public.sintomo_prodotto (
  sintomo_id bigint NOT NULL REFERENCES public.sintomi_rimedi_digiuno(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.partner_products(id) ON DELETE CASCADE,
  PRIMARY KEY (sintomo_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sintomo_prodotto_sintomo ON public.sintomo_prodotto(sintomo_id);
CREATE INDEX IF NOT EXISTS idx_sintomo_prodotto_product ON public.sintomo_prodotto(product_id);

-- 2) Inserisce le associazioni (sintomo ↔ prodotto) in base ai nomi
--    Se un sintomo o un prodotto non esiste, quella riga viene saltata (nessun errore).

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Calma Adattogeni' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%mal di testa%' OR s.sintomo ILIKE '%Mal di testa%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Metabolic Mag PLUS' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%cramp%' OR s.sintomo ILIKE '%Cramp%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Lax-A-Metabolic' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%stitichezza%' OR s.sintomo ILIKE '%Stitichezza%' OR s.sintomo ILIKE '%intestin%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Enzy-Metabolic' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%gonfiore%' OR s.sintomo ILIKE '%Gonfiore%' OR s.sintomo ILIKE '%digestion%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Potassio Citrato' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%cramp%' OR s.sintomo ILIKE '%pressione%' OR s.sintomo ILIKE '%liquidi%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Omega-3 Alaska' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%infiamm%' OR s.sintomo ILIKE '%testa%' OR s.sintomo ILIKE '%cuore%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Flora Metabolic (Probiotici)' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%intestinal%' OR s.sintomo ILIKE '%flora%' OR s.sintomo ILIKE '%regolarit%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Zero WATER' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%ritenzione%' OR s.sintomo ILIKE '%acqua%' OR s.sintomo ILIKE '%gonfiore%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

INSERT INTO public.sintomo_prodotto (sintomo_id, product_id)
SELECT s.id, p.id
FROM sintomi_rimedi_digiuno s
JOIN ( SELECT id FROM partner_products WHERE product_name = 'Calma Adattogeni' LIMIT 1 ) p ON true
WHERE s.sintomo ILIKE '%stress%' OR s.sintomo ILIKE '%nervos%' OR s.sintomo ILIKE '%cortisolo%'
LIMIT 1
ON CONFLICT (sintomo_id, product_id) DO NOTHING;

-- Fine script
