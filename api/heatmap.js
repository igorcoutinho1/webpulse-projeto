import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    try {
        const ontem = new Date();
        ontem.setHours(ontem.getHours() - 24);

        // Puxa o LOG real
        const { data, error } = await supabase.from('historico_status').select('*').gte('data_verificacao', ontem.toISOString());
        if (error) throw error;

        let logsAgrupados = {};
        const sites = ["whatsapp", "facebook", "google", "youtube", "instagram", "itau", "nubank", "vivo", "claro", "caixa", "amazon", "bancodobrasil", "tim", "correios", "santander", "bancocentraldobrasil", "mercadolivre", "uol", "bradesco", "picpay"];
        sites.forEach(site => logsAgrupados[site] = []);

        // Separa a hora de cada log
        data.forEach(log => {
            const d = new Date(log.data_verificacao);
            const horaStr = d.getHours().toString().padStart(2, '0');
            if(logsAgrupados[log.nome_servico]) logsAgrupados[log.nome_servico].push({ hora: horaStr, status: log.status.toLowerCase() });
        });

        let heatmap_final = {};
        
        // Constrói a linha do tempo (24 horas)
        sites.forEach(site => {
            let blocos_24h = [];
            for (let i = 0; i < 24; i++) {
                const dataSlot = new Date();
                dataSlot.setHours(dataSlot.getHours() - (23 - i));
                const horaDoSlot = dataSlot.getHours().toString().padStart(2, '0');
                
                const logsDaHora = logsAgrupados[site].filter(l => l.hora === horaDoSlot);
                let statusPredominante = 'vazio';
                
                if (logsDaHora.length > 0) {
                    // Pior cenário domina a cor daquela hora
                    if (logsDaHora.some(l => l.status === 'offline')) statusPredominante = 'offline';
                    else if (logsDaHora.some(l => l.status === 'lento')) statusPredominante = 'lento';
                    else if (logsDaHora.some(l => l.status === 'instável')) statusPredominante = 'instável';
                    else statusPredominante = 'online';
                }
                blocos_24h.push({ hora: `${horaDoSlot}:00`, status: statusPredominante });
            }
            heatmap_final[site] = blocos_24h;
        });

        return res.status(200).json(heatmap_final);
    } catch (erro) {
        return res.status(500).json({ erro: erro.message });
    }
}
