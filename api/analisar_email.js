import dns from 'dns/promises';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

    const { remetente = "", conteudo = "" } = req.body;
    const conteudoLower = conteudo.toLowerCase();
    const dominio = remetente.split("@")[1] || "";

    let itens = [];
    let score = 0;
    let perigoCritico = false;

    if (!dominio) {
        return res.status(200).json({ status: "reprovado", mensagem: "Remetente inválido. Falta o @dominio.", itens: [] });
    }

    // 1. Verificação de Provedores Gratuitos (Qualquer um pode criar)
    const provedoresGratuitos = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
    const isFree = provedoresGratuitos.includes(dominio);

    if (isFree) {
        itens.push({ titulo: "Remetente Genérico", valor: `Provedor gratuito (${dominio}). Muito usado em golpes pois não exige comprovação de identidade.`, status: "suspeito" });
    } else {
        itens.push({ titulo: "Domínio Corporativo", valor: `E-mail vindo de domínio próprio (${dominio}).`, status: "aprovado" });
        score += 1;
    }

    // 2. Autenticação DNS (A Prova de Fogo) - Verifica se o e-mail não foi forjado
    try {
        const registrosSPF = await dns.resolveTxt(dominio);
        const spfPass = registrosSPF.some(r => r.join('').includes('v=spf1'));
        
        if (spfPass) { 
            score += 2; 
            itens.push({ titulo: "Autenticação SPF", valor: "O domínio possui regras de segurança válidas (Não foi falsificado).", status: "aprovado" }); 
        } else { 
            score -= 2; 
            itens.push({ titulo: "Autenticação SPF", valor: "O domínio NÃO possui validação. Pode ser um e-mail clonado/forjado.", status: "reprovado" }); 
            perigoCritico = true; 
        }
    } catch (e) {
        score -= 2; 
        itens.push({ titulo: "Validação de Domínio", valor: "Não foi possível confirmar a existência deste domínio na internet.", status: "reprovado" }); 
        perigoCritico = true;
    }

    // 3. Detecção de Phishing (Contexto de Urgência + Ação)
    const temLink = /https?:\/\//.test(conteudoLower);
    const palavrasUrgencia = ["urgente", "bloqueado", "cancelamento", "imediatamente", "vencimento", "suspensa", "encerra", "irregularidade"];
    const palavrasAcao = ["clique aqui", "acesse o link", "atualizar dados", "fatura", "pagamento", "senha", "confirmar"];
    
    const urgenciaFound = palavrasUrgencia.some(p => conteudoLower.includes(p));
    const acaoFound = palavrasAcao.some(p => conteudoLower.includes(p));

    if (urgenciaFound && acaoFound && temLink) {
        score -= 3;
        itens.push({ titulo: "Tática de Phishing", valor: "O texto mistura senso de urgência com links de ação. Típico de fraudes bancárias.", status: "reprovado" });
    } else if (temLink && isFree) {
        score -= 1;
        itens.push({ titulo: "Links e Provedor Gratuito", valor: "O e-mail contém links, mas vem de um provedor gratuito. Não clique a menos que conheça o remetente.", status: "suspeito" });
    }

    // 4. Detecção de Anexos (O Alerta Solicitado)
    const regexAnexo = /(em anexo|segue anexo|arquivo|comprovante|\.pdf|\.zip|\.exe|\.rar|\.xls|\.doc)/i;
    const base64Regex = /([A-Za-z0-9+/=\s]{300,})/g; // Captura imagens ou anexos embutidos no código
    
    const temPalavraAnexo = regexAnexo.test(conteudoLower);
    const temBase64 = base64Regex.test(conteudo);

    if (temPalavraAnexo || temBase64) {
        score -= 1; 
        itens.push({ 
            titulo: "⚠️ ALERTA DE ANEXO", 
            valor: "Há indicativos de arquivos ou anexos neste e-mail. Tome muito cuidado ao abrir! Apenas faça o download se você confia plenamente no remetente e estava esperando este arquivo.", 
            status: "suspeito" 
        });
    }

    // 5. Veredito Final Inteligente
    let statusFinal = "aprovado";
    let mensagem = "O e-mail possui boa reputação e origem validada (SPF).";

    if (perigoCritico || score <= -1) {
        statusFinal = "reprovado";
        mensagem = "ALTO RISCO: Este e-mail reprovou nas verificações de segurança. Não clique em links ou baixe anexos.";
    } else if (score < 2 || (isFree && (temLink || temPalavraAnexo))) {
        statusFinal = "suspeito";
        mensagem = "CUIDADO: E-mail de origem gratuita ou com elementos suspeitos.";
    }

    return res.status(200).json({ itens, status: statusFinal, mensagem });
}
