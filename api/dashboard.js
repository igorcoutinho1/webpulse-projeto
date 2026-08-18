import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    // Busca os dados da tabela de serviços no Supabase
    const { data, error } = await supabase.from('status_servicos').select('*');
    
    if (error || !data) {
        return res.status(500).json({ labels: [], uptime: [], alertas: [] });
    }

    let labels = [];
    let uptimes = [];
    let alertas = [];

    data.forEach(servico => {
        labels.push(servico.nome_servico);
        // Como o Supabase sempre guarda o status atual mais recente, estimamos o uptime
        uptimes.push(servico.status === 'online' ? 100 : 0); 
        
        if (servico.status !== 'online') {
            alertas.push({ 
                site: servico.nome_servico, 
                tipo: servico.status, 
                hora: new Date(servico.ultima_verificacao).toLocaleTimeString() 
            });
        }
    });

    return res.status(200).json({ labels, uptime: uptimes, alertas });
}