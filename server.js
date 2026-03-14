const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://bfmrnfnhskcgvhitpzuh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_UXABf053HGuNjTSOQvAhfQ_mjXwtkV0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function toISOString(value) {
  if (value == null) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', async (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username troppo corto (min 3 caratteri).' });
  }

  const clean = username.trim();

  const { data: existing } = await supabase
    .from('digiuno_users')
    .select('id, username')
    .eq('username', clean)
    .maybeSingle();

  let user = existing;
  if (!user) {
    const { data: inserted, error } = await supabase
      .from('digiuno_users')
      .insert({ username: clean })
      .select('id, username')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Errore durante la registrazione.' });
    }
    user = inserted;
  }

  const { data: active } = await supabase
    .from('digiuno_fast_sessions')
    .select('id, start_time')
    .eq('user_id', user.id)
    .is('end_time', null)
    .maybeSingle();

  res.json({
    id: user.id,
    username: user.username,
    isFasting: !!active,
    startTime: active ? toISOString(active.start_time) : null,
  });
});

app.post('/api/start', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante.' });
  }

  const { data: user } = await supabase
    .from('digiuno_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!user) {
    return res.status(404).json({ error: 'Utente non trovato.' });
  }

  const { data: active } = await supabase
    .from('digiuno_fast_sessions')
    .select('id')
    .eq('user_id', userId)
    .is('end_time', null)
    .maybeSingle();

  if (active) {
    return res.status(400).json({ error: 'Hai già un digiuno attivo.' });
  }

  const { data: started, error } = await supabase
    .from('digiuno_fast_sessions')
    .insert({ user_id: userId, start_time: new Date().toISOString() })
    .select('start_time')
    .single();

  if (error) {
    return res.status(500).json({ error: 'Errore avvio digiuno.' });
  }
  const startTime = toISOString(started?.start_time) || new Date().toISOString();
  res.json({ success: true, startTime });
});

app.post('/api/stop', async (req, res) => {
  const { userId, elapsedSeconds } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante.' });
  }

  const { data: active } = await supabase
    .from('digiuno_fast_sessions')
    .select('id, start_time')
    .eq('user_id', userId)
    .is('end_time', null)
    .maybeSingle();

  if (!active) {
    return res.status(400).json({ error: 'Nessun digiuno attivo.' });
  }

  let endTimeIso;
  if (typeof elapsedSeconds === 'number' && elapsedSeconds >= 0 && active.start_time) {
    const startMs = new Date(active.start_time).getTime();
    endTimeIso = new Date(startMs + elapsedSeconds * 1000).toISOString();
  } else {
    endTimeIso = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from('digiuno_fast_sessions')
    .update({ end_time: endTimeIso })
    .eq('id', active.id);

  if (updateErr) {
    console.error(updateErr);
    return res.status(500).json({ error: 'Errore terminando il digiuno.' });
  }

  const { data: resetRow } = await supabase
    .from('leaderboard_reset')
    .select('reset_at')
    .eq('id', 1)
    .maybeSingle();
  const resetAt = resetRow?.reset_at ? new Date(resetRow.reset_at).getTime() : 0;

  const { data: sessions } = await supabase
    .from('digiuno_fast_sessions')
    .select('start_time, end_time')
    .eq('user_id', userId);

  let totalHours = 0;
  if (Array.isArray(sessions)) {
    for (const s of sessions) {
      const start = new Date(s.start_time).getTime();
      const end = s.end_time ? new Date(s.end_time).getTime() : Date.now();
      // Se il digiuno è iniziato prima del reset, conteggia solo la parte dopo resetAt
      const effectiveStart = Math.max(start, resetAt);
      if (end > effectiveStart) {
        totalHours += (end - effectiveStart) / 3600000;
      }
    }
  }

  const { data: userRow } = await supabase
    .from('digiuno_users')
    .select('username, created_at')
    .eq('id', userId)
    .single();

  const leaderboardRow = userRow
    ? {
        id: userId,
        username: userRow.username,
        created_at: userRow.created_at,
        total_hours: totalHours,
        is_fasting: false,
        active_start_time: null,
      }
    : null;

  res.json({ success: true, leaderboardRow });
});

app.post('/api/cancel', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante.' });
  }

  const { data: active } = await supabase
    .from('digiuno_fast_sessions')
    .select('id')
    .eq('user_id', userId)
    .is('end_time', null)
    .maybeSingle();

  if (!active) {
    return res.status(400).json({ error: 'Nessun digiuno attivo da annullare.' });
  }

  await supabase.from('digiuno_fast_sessions').delete().eq('id', active.id);
  res.json({ success: true });
});

app.get('/api/active', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante.' });
  }

  const { data: active } = await supabase
    .from('digiuno_fast_sessions')
    .select('start_time')
    .eq('user_id', userId)
    .is('end_time', null)
    .maybeSingle();

  if (!active) {
    return res.json({ isFasting: false, startTime: null });
  }
  res.json({ isFasting: true, startTime: toISOString(active.start_time) });
});

app.delete('/api/user', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante.' });
  }

  const { data: user } = await supabase
    .from('digiuno_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!user) {
    return res.status(404).json({ error: 'Utente non trovato.' });
  }

  await supabase.from('digiuno_users').delete().eq('id', userId);
  res.json({ success: true });
});

app.post('/api/clear-time', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId mancante.' });
  }

  const { data: user } = await supabase
    .from('digiuno_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!user) {
    return res.status(404).json({ error: 'Utente non trovato.' });
  }

  await supabase.from('digiuno_fast_sessions').delete().eq('user_id', userId);
  res.json({ success: true });
});

app.get('/api/leaderboard', async (req, res) => {
  const { data: rows, error } = await supabase
    .from('digiuno_leaderboard')
    .select('id, username, total_hours, is_fasting, created_at, active_start_time')
    .order('total_hours', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Errore lettura classifica.' });
  }
  res.json(rows || []);
});

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();

app.get('/api/admin/check', (req, res) => {
  const { username } = req.query;
  if (!username) return res.json({ admin: false });
  const isAdmin = ADMIN_USERNAME && username.trim().toLowerCase() === ADMIN_USERNAME;
  res.json({ admin: !!isAdmin });
});

app.post('/api/admin/reset-leaderboard', async (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username mancante.' });
  }
  if (!ADMIN_USERNAME) {
    return res.status(503).json({ error: 'Azzera classifica non configurato (manca ADMIN_USERNAME).' });
  }
  if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
    return res.status(403).json({ error: 'Solo l\'admin può azzerare la classifica.' });
  }
  try {
    const resetAt = new Date().toISOString();
    const { error } = await supabase
      .from('leaderboard_reset')
      .upsert({ id: 1, reset_at: resetAt }, { onConflict: 'id' });

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Errore durante l\'azzeramento della classifica. Controlla i log Supabase.',
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno: ' + (err.message || String(err)) });
  }
});

app.post('/api/admin/clear-user-time', async (req, res) => {
  const { username, targetUserId } = req.body || {};
  if (!username || typeof username !== 'string' || !targetUserId) {
    return res.status(400).json({ error: 'Dati mancanti.' });
  }
  if (!ADMIN_USERNAME) {
    return res.status(503).json({ error: 'Funzione admin non configurata (manca ADMIN_USERNAME).' });
  }
  if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
    return res.status(403).json({ error: 'Solo l\'admin può eliminare i tempi di un utente.' });
  }

  try {
    await supabase.from('digiuno_fast_sessions').delete().eq('user_id', targetUserId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore eliminando i tempi di questo utente.' });
  }
});

// Classifica storica dei digiuni di gruppo (Supabase)
app.get('/api/group-history', async (req, res) => {
  try {
    const { data: groups, error: groupError } = await supabase
      .from('group_fasts')
      .select('id, fast_date, name')
      .order('fast_date', { ascending: false });

    if (groupError) {
      console.error(groupError);
      return res.status(500).json({ error: 'Errore lettura gruppi da Supabase.' });
    }

    const { data: results, error: resultsError } = await supabase
      .from('group_fast_results')
      .select('group_fast_id, username, total_hours');

    if (resultsError) {
      console.error(resultsError);
      return res.status(500).json({ error: 'Errore lettura risultati da Supabase.' });
    }

    const byGroup = new Map();
    for (const row of results || []) {
      const list = byGroup.get(row.group_fast_id) || [];
      list.push(row);
      byGroup.set(row.group_fast_id, list);
    }

    const history = (groups || []).map((g) => {
      const list = byGroup.get(g.id) || [];
      if (list.length === 0) {
        return {
          id: g.id,
          fast_date: g.fast_date,
          name: g.name,
          winner_username: null,
          winner_hours: null,
        };
      }

      let winner = list[0];
      for (const r of list) {
        if (r.total_hours > winner.total_hours) {
          winner = r;
        }
      }

      return {
        id: g.id,
        fast_date: g.fast_date,
        name: g.name,
        winner_username: winner.username,
        winner_hours: winner.total_hours,
      };
    });

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno Supabase.' });
  }
});

// Record migliori salvati su Supabase (assoluto + per utente)
app.get('/api/group-records', async (req, res) => {
  try {
    const { data: allResults, error: resultsError } = await supabase
      .from('group_fast_results')
      .select('id, group_fast_id, username, total_hours, created_at');

    if (resultsError) {
      console.error(resultsError);
      return res.status(500).json({ error: 'Errore lettura risultati da Supabase.' });
    }

    if (!allResults || allResults.length === 0) {
      return res.json({ bestOverall: null, bestPerUser: [] });
    }

    // Record assoluto
    let bestOverallRow = allResults[0];
    for (const row of allResults) {
      if (row.total_hours > bestOverallRow.total_hours) {
        bestOverallRow = row;
      }
    }

    // Recupera info sul group_fast del record assoluto
    let bestOverall = null;
    if (bestOverallRow) {
      const { data: group, error: groupError } = await supabase
        .from('group_fasts')
        .select('id, fast_date, name')
        .eq('id', bestOverallRow.group_fast_id)
        .single();

      if (groupError) {
        console.error(groupError);
      }

      bestOverall = {
        username: bestOverallRow.username,
        total_hours: bestOverallRow.total_hours,
        fast_date: group ? group.fast_date : null,
        group_name: group ? group.name : null,
      };
    }

    // Miglior risultato per ogni utente
    const bestPerUserMap = new Map();
    for (const row of allResults) {
      const existing = bestPerUserMap.get(row.username);
      if (!existing || row.total_hours > existing.total_hours) {
        bestPerUserMap.set(row.username, {
          username: row.username,
          total_hours: row.total_hours,
        });
      }
    }

    const bestPerUser = Array.from(bestPerUserMap.values()).sort(
      (a, b) => b.total_hours - a.total_hours
    );

    res.json({ bestOverall, bestPerUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno Supabase.' });
  }
});

// Migliori risultati personali per un utente (storico Supabase)
app.get('/api/my-group-records', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Parametro "username" mancante.' });
  }

  try {
    const { data, error } = await supabase
      .from('group_fast_results')
      .select('username, total_hours, created_at, group_fast_id')
      .eq('username', username)
      .order('total_hours', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Errore lettura risultati personali da Supabase.' });
    }

    if (!data || data.length === 0) {
      return res.json([]);
    }

    const groupIds = Array.from(new Set(data.map((r) => r.group_fast_id)));

    const { data: groups, error: groupError } = await supabase
      .from('group_fasts')
      .select('id, fast_date, name')
      .in('id', groupIds);

    if (groupError) {
      console.error(groupError);
      return res.status(500).json({ error: 'Errore lettura eventi da Supabase.' });
    }

    const groupMap = new Map();
    for (const g of groups || []) {
      groupMap.set(g.id, g);
    }

    const enriched = data.map((row) => {
      const g = groupMap.get(row.group_fast_id);
      return {
        username: row.username,
        total_hours: row.total_hours,
        created_at: row.created_at,
        fast_date: g ? g.fast_date : null,
        group_name: g ? g.name : null,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno Supabase.' });
  }
});

// Elenco sintomi disponibili dalla tabella sintomi_rimedi_digiuno (Supabase)
app.get('/api/symptoms', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sintomi_rimedi_digiuno')
      .select('id, fase, sintomo')
      .order('fase', { ascending: true })
      .order('sintomo', { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Errore lettura sintomi da Supabase.' });
    }

    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno Supabase.' });
  }
});

// Dettaglio rimedio per un singolo sintomo
app.get('/api/symptom', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Parametro "id" mancante.' });
  }

  try {
    const { data, error } = await supabase
      .from('sintomi_rimedi_digiuno')
      .select('id, fase, sintomo, rimedio, note')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Errore lettura rimedio da Supabase.' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Sintomo non trovato.' });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno Supabase.' });
  }
});

// Prodotti partner associati a un sintomo (tabella sintomo_prodotto + partner_products)
app.get('/api/symptom/products', async (req, res) => {
  const { id: symptomId } = req.query;
  if (!symptomId) {
    return res.status(400).json({ error: 'Parametro "id" (sintomo) mancante.' });
  }

  try {
    const { data: links, error: linkError } = await supabase
      .from('sintomo_prodotto')
      .select('product_id')
      .eq('sintomo_id', symptomId);

    if (linkError) {
      console.error(linkError);
      return res.status(500).json({ error: 'Errore lettura associazioni sintomo-prodotto.' });
    }

    if (!links?.length) {
      return res.json([]);
    }

    const productIds = [...new Set(links.map((l) => l.product_id))];
    const { data: products, error: prodError } = await supabase
      .from('partner_products')
      .select('id, brand_name, product_name, category, image_url, shop_url, description, discount_code, price, is_active')
      .in('id', productIds);

    if (prodError) {
      console.error(prodError);
      return res.status(500).json({ error: 'Errore lettura prodotti partner.' });
    }

    const active = (products || []).filter((p) => p.is_active === true || p.is_active === 'true');
    res.json(active);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno Supabase.' });
  }
});

// Catch-all per la SPA (sintassi compatibile con Express 5)
app.get('/{*any}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
  });
}

module.exports = app;

