import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const sitesParaTestar = [
    { nome: 'whatsapp', url: 'https://web.whatsapp.com/' }, { nome: 'facebook', url: 'https://facebook.com/' },
    { nome: 'google', url: 'https://www.google.com' }, { nome: 'youtube', url: 'https://www.youtube.com' },
    { nome: 'instagram', url: 'https://instagram.com/' }, { nome: 'itau', url: 'https://itau.com.br/' },
    { nome: 'nubank', url: 'https://nubank.com.br/' }, { nome: 'vivo', url: 'https://vivo.com.br/' },
    { nome: 'claro', url: 'https://www.claro.com.br/' }, { nome: 'caixa', url: 'https://caixa.gov.br/' },
    { nome: 'amazon', url: 'https://amazon.com.br' }, { nome: 'bancodobrasil', url: 'https://bb.com.br/' },
    { nome: 'tim', url: 'https://tim.com.br/' }, { nome: 'correios', url: 'https://correios.com.br/' },
    { nome: 'santander', url: 'https://santander.com.br/' }, { nome: 'bancocentraldobrasil', url: 'https://bcb.gov.br/' },
    { nome: 'mercadolivre', url: 'https://mercadolivre.com.br/' }, { nome: 'uol', url: 'https://uol.com.br/' },
    { nome: 'bradesco', url: 'https://bradesco.com.br/' }, { nome: 'picpay', url: 'https://picpay.com.br/' }
];

export default async function handler(req, res) {
    const promessas = sitesParaTestar.map(async (site) => {
        let statusFinal = 'offline';
        const inicio = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const resposta = await fetch(site.url, { method: 'HEAD', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' }});
            clearTimeout(timeoutId);
            const tempo = Date.now() - inicio;

            if (resposta.status) {
                if (tempo > 2500) statusFinal = 'lento';
                else if (tempo > 1200) statusFinal = 'instável'; // Mais realista
                else statusFinal = 'online';
            }
        } catch (erro) { statusFinal = 'offline'; }

        return { nome_servico: site.nome, status: statusFinal, data_verificacao: new Date().toISOString() };
    });

    const resultados = await Promise.all(promessas);

    // 1. Salva na tabela atual (para leitura rápida) e no Log (para gráficos)
    await supabase.from('status_servicos').upsert(resultados, { onConflict: 'nome_servico' });
    await supabase.from('historico_status').insert(resultados);

    // 2. Limpeza Inteligente: Apaga logs com mais de 24 horas!
    const ontem = new Date();
    ontem.setHours(ontem.getHours() - 24);
    await supabase.from('historico_status').delete().lt('data_verificacao', ontem.toISOString());

    return res.status(200).json({ mensagem: 'Logs reais salvos e limpeza de 24h executada!' });
}
