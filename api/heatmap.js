import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    // Cache de 10 segundos para carregar o mapa de calor rápido
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    try {
        const { data, error } = await supabase.from('status_servicos').select('*');
        if (error) throw error;

        let dados_heatmap = {};
        
        data.forEach(servico => {
            const blocos = [];
            
            // Cria 24 quadradinhos simulando o histórico completo
            for (let i = 0; i < 24; i++) {
                const dataPassada = new Date();
                dataPassada.setHours(dataPassada.getHours() - (23 - i));
                const hora_formatada = dataPassada.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                blocos.push({ 
                    hora: hora_formatada, 
                    // O .toLowerCase() resolve o problema do CSS invisível no HTML
                    status: (servico.status || 'vazio').toLowerCase() 
                });
            }

            dados_heatmap[servico.nome_servico] = blocos;
        });

        return res.status(200).json(dados_heatmap);
    } catch (erro) {
        return res.status(500).json({ erro: erro.message });
    }
}
