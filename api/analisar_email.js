import dns from 'dns/promises';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

    const { remetente = "", conteudo = "" } = req.body;
    const conteudoLower = conteudo.toLowerCase();
    const dominio = remetente.split("@")[1] || "";

    let itens = [];
    let score = 0;

    // 1. Verificação Especial: Autenticação (2FA)
    const codigoCurto = conteudo.match(/\b(\d{4,8})\b/);
    const poucoTexto = conteudo.length < 150;
    const semLinks = !/https?:\/\//.test(conteudoLower);

    if (codigoCurto && poucoTexto && semLinks && (dominio.includes("fortinet") || dominio === "gov.br")) {
        return res.status(200).json({
            itens: [
                { titulo: "Código 2FA", valor: `Código detectado: ${codigoCurto[1]}`, status: "aprovado" },
                { titulo: "Veredito Final", valor: "E-mail legítimo de autenticação validado.", status: "aprovado" }
            ],
            status: "aprovado",
            mensagem: "E-mail de autenticação simples e seguro."
        });
    }

    // 2. Palavras Suspeitas
    const palavrasSuspeitas = ["ganhou", "senha", "urgente", "clique", "premio", "fatura", "cancelar", "bloqueado"];
    const encontradas = palavrasSuspeitas.filter(p => conteudoLower.includes(p));
    
    if (encontradas.length > 0) {
        score -= 2;
        itens.push({ titulo: "Conteúdo Suspeito", valor: `Palavras detectadas: ${encontradas.join(', ')}`, status: "suspeito" });
    } else {
        score += 1;
    }

    // 3. Remetente Confiável
    const confiaveis = ["gmail.com", "outlook.com", "hotmail.com", "gov.br", "itau.com.br", "caixa.gov.br", "bradesco.com.br"];
    if (confiaveis.includes(dominio)) {
        score += 2;
        itens.push({ titulo: "Remetente Confiável", valor: `Domínio comum (${dominio})`, status: "aprovado" });
    } else {
        score -= 1;
        itens.push({ titulo: "Remetente Desconhecido", valor: `Domínio: ${dominio}`, status: "suspeito" });
    }

    // 4. Autenticação DNS (SPF e DMARC)
    try {
        const registrosSPF = await dns.resolveTxt(dominio);
        const temSPF = registrosSPF.some(r => r.join('').includes('v=spf1'));
        itens.push({ titulo: "Autenticação SPF", valor: dominio, status: temSPF ? "aprovado" : "suspeito" });
        if (temSPF) score += 1; else score -= 1;
    } catch (e) {
        itens.push({ titulo: "Autenticação SPF", valor: "Falha ao ler DNS", status: "suspeito" });
    }

    try {
        const registrosDMARC = await dns.resolveTxt(`_dmarc.${dominio}`);
        const temDMARC = registrosDMARC.some(r => r.join('').includes('v=DMARC1'));
        itens.push({ titulo: "Autenticação DMARC", valor: dominio, status: temDMARC ? "aprovado" : "suspeito" });
        if (temDMARC) score += 1;
    } catch (e) {
        itens.push({ titulo: "Autenticação DMARC", valor: "Não encontrado", status: "suspeito" });
    }

    // 5. Detecção de Anexos em Base64
    const base64Regex = /([A-Za-z0-9+/=\s]{300,})/g;
    const base64Matches = conteudo.match(base64Regex);
    if (base64Matches) {
        score -= 1;
        itens.push({ titulo: "Anexo Base64", valor: "Código embutido detectado. Pode ser um anexo ou imagem.", status: "suspeito" });
    }

    // 6. Veredito Final
    let statusFinal = "aprovado";
    let mensagem = "O e-mail aparenta ser seguro.";

    if (score <= -2) {
        statusFinal = "reprovado";
        mensagem = "O e-mail apresenta riscos claros (Phishing/Malware).";
    } else if (score <= 0) {
        statusFinal = "suspeito";
        mensagem = "O e-mail contém sinais de alerta. Requer atenção.";
    }

    return res.status(200).json({ itens, status: statusFinal, mensagem });
}