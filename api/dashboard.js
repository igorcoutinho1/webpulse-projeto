import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    try {
        const hoje = new Date();
        hoje.setHours(hoje.getHours() - 24);

        const { data, error } = await supabase.from('historico_status').select('*').gte('data_verificacao', hoje.toISOString()).order('data_verificacao', { ascending: true });
        if (error) throw error;

        let labels = [];
        let uptimes = [];
        let alertas = [];
        
        const estatisticas = {};
        let ultimoAlertaSite = {}; // Evita flood de alertas repetidos

        data.forEach(log => {
            if (!estatisticas[log.nome_servico]) estatisticas[log.nome_servico] = { total: 0, online: 0 };
            
            estatisticas[log.nome_servico].total += 1;
            if (log.status === 'online' || log.status === 'estável') estatisticas[log.nome_servico].online += 1;

            // Filtro Inteligente de Alertas
            if (log.status !== 'online' && log.status !== 'estável') {
                if (ultimoAlertaSite[log.nome_servico] !== log.status) {
                    alertas.push({ site: log.nome_servico, tipo: log.status, hora: new Date(log.data_verificacao).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
                    ultimoAlertaSite[log.nome_servico] = log.status; // Trava para não repetir
                }
            } else {
                ultimoAlertaSite[log.nome_servico] = 'online'; // Reseta quando volta ao normal
            }
        });

        // Calcula a porcentagem exata de Uptime
        for (const [site, stats] of Object.entries(estatisticas)) {
            labels.push(site);
            uptimes.push(Math.round((stats.online / stats.total) * 100));
        }

        // Pega os 12 alertas mais recentes e inverte para o mais novo ficar no topo
        alertas = alertas.reverse().slice(0, 12);

        return res.status(200).json({ labels, uptime: uptimes, alertas });
    } catch (erro) {
        return res.status(500).json({ erro: erro.message, labels: [], uptime: [], alertas: [] });
    }
}
