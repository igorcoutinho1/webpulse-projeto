export default async function handler(req, res) {
    const sites = {
        "whatsapp": "https://web.whatsapp.com/", "facebook": "https://facebook.com/",
        "google": "https://www.google.com", "youtube": "https://www.youtube.com",
        "instagram": "https://instagram.com/", "itau": "https://itau.com.br/",
        "nubank": "https://nubank.com.br/", "vivo": "https://vivo.com.br/",
        "claro": "https://www.claro.com.br/", "caixa": "https://caixa.gov.br/",
        "amazon": "https://amazon.com.br", "bancodobrasil": "https://bb.com.br/",
        "tim": "https://tim.com.br/", "correios": "https://correios.com.br/",
        "santander": "https://santander.com.br/", "bancocentraldobrasil": "https://bcb.gov.br/",
        "mercadolivre": "https://mercadolivre.com.br/", "uol": "https://uol.com.br/",
        "bradesco": "https://bradesco.com.br/", "picpay": "https://picpay.com.br/"
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s limite
    const resultados = {};
    
    // Dispara todos os testes simultaneamente (muito mais rápido)
    const promessas = Object.entries(sites).map(async ([nome, url]) => {
        const inicio = Date.now();
        try {
            // Usa 'HEAD' para não baixar o site todo, e User-Agent para driblar firewalls
            const req = await fetch(url, { 
                method: 'HEAD', 
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            
            const tempo = Date.now() - inicio;
            
            // Se o servidor respondeu (mesmo que com erro 403 do firewall), ele está online!
            if (req.status) {
                 let status = 'Online';
                 let cor = '#2ecc71'; // Verde
                 if(tempo > 2000) { status = 'Lento'; cor = '#9b59b6'; }
                 else if (tempo > 1000) { status = 'Estável'; cor = '#f39c12'; }
                 
                 resultados[nome] = { status, tempo_ms: tempo, cor, latencia_ms: tempo };
            }
        } catch (e) {
             resultados[nome] = { status: 'Offline', tempo_ms: 0, cor: '#e74c3c', latencia_ms: 0 };
        }
    });

    await Promise.allSettled(promessas);
    clearTimeout(timeoutId);

    // Cache de 10s: se 50 pessoas abrirem o site juntas, a Vercel só executa 1 vez.
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');
    return res.status(200).json(resultados);
}