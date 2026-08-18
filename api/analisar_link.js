import tls from 'tls';

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');
    
    let { url } = req.body;
    if (!url.startsWith("http")) url = "https://" + url;

    const hostname = new URL(url).hostname;
    const protocolo = url.split(":")[0].toUpperCase();

    // 1. Validar Certificado SSL
    const statusCert = await checarSSL(hostname);

    // 2. Procurar Selos Visuais no HTML
    const statusSelos = await checarSelos(url);

    // 3. VirusTotal (Reputação)
    const statusVirusTotal = await checarVirusTotal(hostname);

    let resposta = {
        itens: [
            { titulo: "1. Protocolo", valor: protocolo, status: protocolo === "HTTPS" ? "aprovado" : "suspeito" },
            { titulo: "2. Certificado SSL", valor: statusCert.mensagem, status: statusCert.status },
            { titulo: "3. Selos de Segurança", valor: statusSelos.mensagem, status: statusSelos.status },
            { titulo: "4. Reputação (VirusTotal)", valor: statusVirusTotal.reputacao, status: statusVirusTotal.status_rep },
            { titulo: "5. Ameaças Possíveis", valor: statusVirusTotal.ameacas, status: statusVirusTotal.status_ameacas }
        ]
    };

    // Validação Manual (Lista Branca)
    const sites_confiaveis = ["gov.br", "caixa.gov.br", "bb.com.br", "itau.com.br", "google.com"];
    if (sites_confiaveis.some(site => hostname.includes(site))) {
        resposta.itens.forEach(item => item.status = "aprovado");
        resposta.status_geral = "aprovado";
    } else {
        resposta.status_geral = "dinamico";
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
                const emissor = cert.issuer.O || "Desconhecido";
                resolve({ mensagem: `Emitido por ${emissor}`, status: "aprovado" });
            } else {
                resolve({ mensagem: "Certificado não confiável", status: "suspeito" });
            }
        });
        socket.on('error', () => resolve({ mensagem: "Não encontrado ou inválido", status: "reprovado" }));
    });
}

async function checarSelos(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const resposta = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const html = (await resposta.text()).toLowerCase();
        const termos = ["site seguro", "norton", "mcafee", "ssl", "digicert", "selo de segurança"];
        const encontrados = termos.filter(t => html.includes(t));

        if (encontrados.length > 0) return { mensagem: "Selo detectado: " + encontrados.join(", "), status: "aprovado" };
        return { mensagem: "Nenhum selo encontrado na interface", status: "suspeito" };
    } catch {
        return { mensagem: "Erro ao verificar o site", status: "suspeito" };
    }
}

async function checarVirusTotal(hostname) {
    if (!VIRUSTOTAL_API_KEY) return { reputacao: "Chave API não configurada", ameacas: "Ignorado", status_rep: "suspeito", status_ameacas: "suspeito" };
    
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
            reputacao: rep >= 0 ? "Alta reputação" : "Risco detectado",
            status_rep,
            ameacas: stats.malicious > 0 ? `Detectado malware (${stats.malicious} fontes)` : "Nenhuma ameaça detectada",
            status_ameacas
        };
    } catch {
        return { reputacao: "Falha na análise", ameacas: "Erro ao checar ameaças", status_rep: "suspeito", status_ameacas: "suspeito" };
    }
}