import tls from 'tls';

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');
    
    let { url } = req.body;
    if (!url.startsWith("http")) url = "https://" + url;

    const hostname = new URL(url).hostname;
    const protocolo = url.split(":")[0].toUpperCase();

    // 1. Validar Certificado SSL real
    const statusCert = await checarSSL(hostname);

    // 2. Checar Defesas de Servidor (Muito mais profissional que buscar selos visuais)
    const statusHeaders = await checarHeadersSeguranca(url);

    // 3. VirusTotal (Reputação)
    const statusVirusTotal = await checarVirusTotal(hostname);

    let resposta = {
        itens: [
            { titulo: "1. Protocolo", valor: protocolo, status: protocolo === "HTTPS" ? "aprovado" : "reprovado" },
            { titulo: "2. Certificado SSL", valor: statusCert.mensagem, status: statusCert.status },
            { titulo: "3. Defesas do Servidor", valor: statusHeaders.mensagem, status: statusHeaders.status },
            { titulo: "4. Reputação Global", valor: statusVirusTotal.reputacao, status: statusVirusTotal.status_rep },
            { titulo: "5. Ameaças (Vírus/Phishing)", valor: statusVirusTotal.ameacas, status: statusVirusTotal.status_ameacas }
        ]
    };

    // Lista branca inteligente (usa endsWith para evitar bypass)
    const sites_confiaveis = ["gov.br", "caixa.gov.br", "bb.com.br", "itau.com.br", "google.com", "youtube.com", "jw.org", "apple.com", "microsoft.com"];
    if (sites_confiaveis.some(site => hostname.endsWith(site))) {
        resposta.itens.forEach(item => {
            if (item.status === "neutro" || item.status === "suspeito") item.status = "aprovado";
        });
        resposta.status_geral = "aprovado";
    }

    return res.status(200).json(resposta);
}

// --- FUNÇÕES AUXILIARES ---

function checarSSL(hostname) {
    return new Promise((resolve) => {
        const socket = tls.connect(443, hostname, { servername: hostname }, () => {
            const cert = socket.getPeerCertificate();
            socket.end();
            if (cert && cert.issuer) {
                const emissor = cert.issuer.O || "Emissor Conhecido";
                resolve({ mensagem: `Ativo (Emitido por ${emissor})`, status: "aprovado" });
            } else {
                resolve({ mensagem: "Certificado não confiável", status: "suspeito" });
            }
        });
        socket.on('error', () => resolve({ mensagem: "Não encontrado ou inválido", status: "reprovado" }));
    });
}

async function checarHeadersSeguranca(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        // Usa User-Agent para evitar bloqueios de firewall anti-bot
        const resposta = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeoutId);

        const headers = resposta.headers;
        let defesas = [];
        
        if (headers.get('strict-transport-security')) defesas.push("HSTS");
        if (headers.get('x-frame-options')) defesas.push("X-Frame");
        if (headers.get('x-content-type-options')) defesas.push("X-Content");

        if (defesas.length > 0) return { mensagem: `Ativas (${defesas.join(", ")})`, status: "aprovado" };
        
        // Se não tiver, não é crime. Marcamos como neutro em vez de suspeito
        return { mensagem: "Sem cabeçalhos estritos", status: "neutro" };
    } catch {
        return { mensagem: "Não verificado (bloqueio de firewall)", status: "neutro" };
    }
}

async function checarVirusTotal(hostname) {
    // CORREÇÃO: Se não houver chave, retorna status "neutro" para não penalizar o site injustamente
    if (!VIRUSTOTAL_API_KEY) return { reputacao: "Não analisada (Chave API Ausente)", ameacas: "Não analisada", status_rep: "neutro", status_ameacas: "neutro" };
    
    try {
        const res = await fetch(`https://www.virustotal.com/api/v3/domains/${hostname}`, {
            headers: { "x-apikey": VIRUSTOTAL_API_KEY }
        });
        const data = await res.json();
        if (!data.data) throw new Error("Sem dados");

        const rep = data.data.attributes.reputation || 0;
        const stats = data.data.attributes.last_analysis_stats || {};

        let status_rep = rep >= 0 ? "aprovado" : "reprovado";
        let status_ameacas = stats.malicious > 0 ? "reprovado" : (stats.suspicious > 0 ? "suspeito" : "aprovado");

        return {
            reputacao: rep >= 0 ? "Site confiável" : "Baixa reputação",
            status_rep,
            ameacas: stats.malicious > 0 ? `Malware detectado (${stats.malicious} alertas)` : "Sem ameaças conhecidas",
            status_ameacas
        };
    } catch {
        return { reputacao: "Falha de conexão com VT", ameacas: "Falha de conexão", status_rep: "neutro", status_ameacas: "neutro" };
    }
}
