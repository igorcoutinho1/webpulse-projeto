import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    const { data, error } = await supabase.from('status_servicos').select('*');
    
    if (error || !data) return res.status(500).json({});

    let dados_heatmap = {};
    
    data.forEach(servico => {
        const hora = new Date(servico.ultima_verificacao).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        // Simulando a linha do tempo do heatmap com o status atual repetido ou log real
        dados_heatmap[servico.nome_servico] = [
            { hora: hora, status: servico.status }
            // No futuro, você pode criar uma tabela de "logs" no Supabase para puxar 24 blocos reais
        ];
    });

    return res.status(200).json(dados_heatmap);
}