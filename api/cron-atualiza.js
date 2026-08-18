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
    console.log("Iniciando verificação Cron...");

    // 1. Testa todos os 20 sites SIMULTANEAMENTE (Paralelo)
    const promessas = sitesParaTestar.map(async (site) => {
        let statusFinal = 'offline';
        const inicio = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s de limite
            
            const resposta = await fetch(site.url, { 
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebPulseBot/1.0' }
            });
            clearTimeout(timeoutId);

            const tempo = Date.now() - inicio;

            if (resposta.status) {
                if (tempo > 2500) statusFinal = 'lento';
                else if (tempo > 1200) statusFinal = 'estável';
                else statusFinal = 'online';
            }
        } catch (erro) {
            statusFinal = 'offline';
        }

        return { 
            nome_servico: site.nome, 
            status: statusFinal, 
            ultima_verificacao: new Date().toISOString() 
        };
    });

    // 2. Aguarda todos os testes terminarem
    const resultados = await Promise.all(promessas);

    // 3. Salva TODOS os 20 sites no Supabase de uma só vez (muito mais rápido!)
    await supabase
        .from('status_servicos')
        .upsert(resultados, { onConflict: 'nome_servico' });

    return res.status(200).json({ mensagem: 'Cron executado com sucesso e logs salvos instantaneamente!' });
}