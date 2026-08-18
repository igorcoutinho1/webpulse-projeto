import Parser from 'rss-parser';

const parser = new Parser();

export default async function handler(req, res) {
    const feeds = [
        "https://g1.globo.com/rss/g1/tecnologia/",
        "https://www.tecmundo.com.br/rss",
        "https://olhardigital.com.br/feed/"
    ];

    const palavras_chave = ["tecnologia", "segurança", "rede", "ciber", "internet", "whatsapp", "google", "instagram", "falha", "hacker", "dados", "ataque", "vírus", "vazamento"];
    const palavras_proibidas = ["sexo", "adulto", "namoro", "fofoca", "apostas", "bet"];

    let noticias_filtradas = [];

    try {
        for (const url of feeds) {
            const feed = await parser.parseURL(url);
            
            for (const item of feed.items) {
                const titulo = (item.title || "").toLowerCase();
                const resumo = (item.contentSnippet || item.content || "").toLowerCase();

                // Regras de filtro
                if (palavras_proibidas.some(p => titulo.includes(p) || resumo.includes(p))) continue;
                if (!palavras_chave.some(p => titulo.includes(p) || resumo.includes(p))) continue;

                // Extrai imagem (Regex básico para pegar src de img no conteúdo se não houver tag específica)
                let imagem = "https://placehold.co/300x150?text=Noticia";
                const imgMatch = (item.content || "").match(/<img[^>]+src="([^">]+)"/);
                if (imgMatch) imagem = imgMatch[1];

                noticias_filtradas.push({
                    titulo: item.title,
                    link: item.link,
                    resumo: resumo.substring(0, 100).replace(/<[^>]*>?/gm, '') + "...",
                    imagem: imagem
                });

                if (noticias_filtradas.length >= 15) break;
            }
            if (noticias_filtradas.length >= 15) break;
        }

        return res.status(200).json(noticias_filtradas);
    } catch (error) {
        return res.status(500).json({ erro: "Falha ao buscar notícias" });
    }
}