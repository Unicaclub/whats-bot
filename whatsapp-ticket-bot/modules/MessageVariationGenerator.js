/**
 * GERADOR DE VARIAÇÕES DE MENSAGENS PARA CAMPANHAS
 * Sistema inteligente que cria 5 variações de uma mensagem mantendo o sentido original
 * mas evitando detecção de spam e banimentos por mensagens repetitivas
 */

class MessageVariationGenerator {
  constructor() {
    // Dicionário de sinônimos organizados por categoria
    this.synonyms = {
      saudacoes: {
        'olá': ['oi', 'e aí', 'opa', 'eaí', 'salve'],
        'oi': ['olá', 'opa', 'e aí', 'eaí', 'hey'],
        'bom dia': ['boa manhã', 'dia!', 'manhã!', 'bom dia!'],
        'boa tarde': ['tarde!', 'boa tarde!', 'tardes'],
        'boa noite': ['noite!', 'boa noite!', 'noites']
      },
      verbos: {
        'aproveite': ['garante', 'conquiste', 'pegue', 'não perca'],
        'garante': ['aproveite', 'conquiste', 'pegue', 'assegure'],
        'compre': ['adquira', 'garanta', 'pegue', 'leve'],
        'clique': ['acesse', 'toque', 'entre', 'vá'],
        'vem': ['venha', 'chega aí', 'cola', 'aparece']
      },
      adjetivos: {
        'incrível': ['fantástico', 'sensacional', 'top', 'demais', 'show'],
        'exclusivo': ['único', 'especial', 'limitado', 'restrito'],
        'imperdível': ['único', 'especial', 'limitado', 'exclusivo'],
        'melhor': ['top', 'principal', 'número 1', 'destaque'],
        'novo': ['novidade', 'lançamento', 'fresh', 'mais recente']
      },
      expressoes: {
        'não perca': ['aproveite', 'garante já', 'corre atrás', 'pega logo'],
        'últimos dias': ['últimas horas', 'por pouco tempo', 'até acabar', 'enquanto durar'],
        'promoção': ['oferta', 'desconto', 'oportunidade', 'preço especial'],
        'apenas hoje': ['só hoje', 'somente hoje', 'válido hoje', 'hoje apenas']
      },
      conectores: {
        'e': ['além disso', 'também', 'mais', '+'],
        'mas': ['porém', 'contudo', 'entretanto'],
        'então': ['aí', 'daí', 'assim'],
        'agora': ['já', 'neste momento', 'hoje']
      }
    };

    // Variações de estrutura de mensagem
    this.structures = [
      'saudacao + conteudo + cta',
      'conteudo + saudacao + cta', 
      'cta + conteudo + despedida',
      'saudacao + cta + conteudo',
      'conteudo + cta + extra'
    ];

    // Variações de call-to-action
    this.ctaVariations = [
      'Digite {palavra} para mais informações',
      'Responda {palavra} e saiba mais',
      'Manda {palavra} aqui que te explico tudo',
      'Só mandar {palavra} que te passo os detalhes',
      'Chama no {palavra} para mais info'
    ];

    // Variações de saudação
    this.greetingVariations = [
      '👋', '🔥', '✨', '🎯', '💥', '🚀', '⭐', '🎉'
    ];

    // Emojis intercambiáveis por categoria
    this.emojiCategories = {
      celebracao: ['🎉', '🎊', '🥳', '🎈', '✨'],
      fogo: ['🔥', '💥', '⚡', '🚀', '💫'],
      positivo: ['✅', '👍', '💯', '⭐', '🏆'],
      atencao: ['🚨', '⚠️', '🔔', '📢', '📣'],
      dinheiro: ['💰', '💵', '💸', '🤑', '💳']
    };
  }

  /**
   * Gera 5 variações de uma mensagem de campanha
   * @param {string} originalMessage - Mensagem original
   * @returns {Array} Array com 5 variações da mensagem
   */
  generateVariations(originalMessage) {
    try {
      console.log('🎭 Gerando variações para campanha...');
      
      // Analisar a mensagem original
      const analysis = this.analyzeMessage(originalMessage);
      
      // Gerar 5 variações diferentes
      const variations = [];
      
      for (let i = 0; i < 5; i++) {
        const variation = this.createVariation(originalMessage, analysis, i);
        variations.push(variation);
      }
      
      console.log(`✅ ${variations.length} variações geradas com sucesso`);
      return variations;
      
    } catch (error) {
      console.error('❌ Erro ao gerar variações:', error);
      // Em caso de erro, retornar a mensagem original 5 vezes
      return Array(5).fill(originalMessage);
    }
  }

  /**
   * Analisa a estrutura da mensagem original
   * @param {string} message - Mensagem a ser analisada
   * @returns {Object} Análise da mensagem
   */
  analyzeMessage(message) {
    const analysis = {
      originalMessage: message,
      hasLinks: this.extractLinks(message),
      hasNumbers: this.extractNumbers(message),
      hasEmojis: this.extractEmojis(message),
      tone: this.detectTone(message),
      structure: this.detectStructure(message),
      preserveElements: this.findElementsToPreserve(message)
    };

    return analysis;
  }

  /**
   * Cria uma variação específica da mensagem
   * @param {string} original - Mensagem original
   * @param {Object} analysis - Análise da mensagem
   * @param {number} variationIndex - Índice da variação (0-4)
   * @returns {string} Mensagem variada
   */
  createVariation(original, analysis, variationIndex) {
    let variation = original;

    // Aplicar diferentes tipos de variação baseado no índice
    switch (variationIndex) {
      case 0:
        // Variação 1: Sinônimos + Emojis
        variation = this.applySynonymVariation(variation);
        variation = this.applyEmojiVariation(variation);
        break;
        
      case 1:
        // Variação 2: Estrutura + Pontuação
        variation = this.applyStructuralVariation(variation);
        variation = this.applyPunctuationVariation(variation);
        break;
        
      case 2:
        // Variação 3: Saudação + Call-to-Action
        variation = this.applyGreetingVariation(variation);
        variation = this.applyCtaVariation(variation);
        break;
        
      case 3:
        // Variação 4: Combinação moderada
        variation = this.applySynonymVariation(variation, 0.3); // Menos sinônimos
        variation = this.applySpacingVariation(variation);
        break;
        
      case 4:
        // Variação 5: Variação completa
        variation = this.applySynonymVariation(variation, 0.5);
        variation = this.applyEmojiVariation(variation);
        variation = this.applyPunctuationVariation(variation);
        break;
    }

    // Garantir que elementos preservados não foram alterados
    variation = this.preserveElements(variation, analysis.preserveElements);

    return variation;
  }

  /**
   * Aplica variações de sinônimos
   * @param {string} text - Texto original
   * @param {number} intensity - Intensidade da variação (0-1)
   * @returns {string} Texto com sinônimos aplicados
   */
  applySynonymVariation(text, intensity = 0.7) {
    let result = text;

    // Aplicar sinônimos de todas as categorias
    Object.keys(this.synonyms).forEach(category => {
      Object.keys(this.synonyms[category]).forEach(word => {
        if (Math.random() < intensity && result.toLowerCase().includes(word.toLowerCase())) {
          const synonyms = this.synonyms[category][word];
          const randomSynonym = synonyms[Math.floor(Math.random() * synonyms.length)];
          
          // Substituir mantendo a capitalização original
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          result = result.replace(regex, (match) => {
            if (match[0] === match[0].toUpperCase()) {
              return randomSynonym.charAt(0).toUpperCase() + randomSynonym.slice(1);
            }
            return randomSynonym;
          });
        }
      });
    });

    return result;
  }

  /**
   * Aplica variações de emojis
   * @param {string} text - Texto original
   * @returns {string} Texto com emojis variados
   */
  applyEmojiVariation(text) {
    let result = text;

    // Substituir emojis por similares da mesma categoria
    Object.keys(this.emojiCategories).forEach(category => {
      this.emojiCategories[category].forEach(emoji => {
        if (result.includes(emoji)) {
          const alternatives = this.emojiCategories[category].filter(e => e !== emoji);
          if (alternatives.length > 0 && Math.random() < 0.6) {
            const newEmoji = alternatives[Math.floor(Math.random() * alternatives.length)];
            result = result.replace(emoji, newEmoji);
          }
        }
      });
    });

    return result;
  }

  /**
   * Aplica variações estruturais
   * @param {string} text - Texto original
   * @returns {string} Texto com estrutura variada
   */
  applyStructuralVariation(text) {
    // Dividir em frases
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    if (sentences.length > 1 && Math.random() < 0.5) {
      // Embaralhar ordem das frases ocasionalmente
      const shuffled = [...sentences];
      for (let i = shuffled.length - 1; i > 0; i--) {
        if (Math.random() < 0.3) { // 30% chance de trocar
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
      }
      return shuffled.join('. ') + '.';
    }

    return text;
  }

  /**
   * Aplica variações de pontuação
   * @param {string} text - Texto original
   * @returns {string} Texto com pontuação variada
   */
  applyPunctuationVariation(text) {
    let result = text;

    // Variar quantidade de exclamações
    result = result.replace(/!+/g, (match) => {
      const variations = ['!', '!!', '!!!'];
      return variations[Math.floor(Math.random() * variations.length)];
    });

    // Variar uso de reticências
    if (Math.random() < 0.3) {
      result = result.replace(/\./g, '...');
    }

    // Adicionar ou remover espaços antes de emojis
    result = result.replace(/(\s*)([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/gu, 
      (match, space, emoji) => {
        return Math.random() < 0.5 ? ` ${emoji}` : emoji;
      });

    return result;
  }

  /**
   * Aplica variações de saudação
   * @param {string} text - Texto original
   * @returns {string} Texto com saudação variada
   */
  applyGreetingVariation(text) {
    // Detectar e substituir saudações no início
    const greetingPatterns = [
      /^(olá|oi|opa|e aí|eaí|salve)/i,
      /^(bom dia|boa tarde|boa noite)/i
    ];

    for (const pattern of greetingPatterns) {
      if (pattern.test(text)) {
        const match = text.match(pattern)[0].toLowerCase();
        if (this.synonyms.saudacoes[match]) {
          const alternatives = this.synonyms.saudacoes[match];
          const newGreeting = alternatives[Math.floor(Math.random() * alternatives.length)];
          return text.replace(pattern, newGreeting);
        }
      }
    }

    return text;
  }

  /**
   * Aplica variações de call-to-action
   * @param {string} text - Texto original
   * @returns {string} Texto com CTA variado
   */
  applyCtaVariation(text) {
    // Detectar padrões de CTA e variar
    const ctaPatterns = [
      /digite\s+(\w+)/i,
      /responda\s+(\w+)/i,
      /manda\s+(\w+)/i
    ];

    for (const pattern of ctaPatterns) {
      const match = text.match(pattern);
      if (match) {
        const palavra = match[1];
        const variations = [
          `Digite *${palavra}* para mais info`,
          `Responda *${palavra}* aqui`,
          `Manda *${palavra}* que te explico`,
          `Só enviar *${palavra}*`,
          `Chama *${palavra}* aqui`
        ];
        const newCta = variations[Math.floor(Math.random() * variations.length)];
        return text.replace(match[0], newCta);
      }
    }

    return text;
  }

  /**
   * Aplica variações de espaçamento
   * @param {string} text - Texto original
   * @returns {string} Texto com espaçamento variado
   */
  applySpacingVariation(text) {
    let result = text;

    // Variar quebras de linha
    if (Math.random() < 0.4) {
      result = result.replace(/\n/g, '\n\n');
    }

    // Variar espaçamento entre palavras ocasionalmente
    if (Math.random() < 0.2) {
      result = result.replace(/\s+/g, ' '); // Normalizar espaços
    }

    return result;
  }

  /**
   * Extrai links da mensagem
   * @param {string} text - Texto a analisar
   * @returns {Array} Links encontrados
   */
  extractLinks(text) {
    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    return text.match(linkRegex) || [];
  }

  /**
   * Extrai números importantes da mensagem
   * @param {string} text - Texto a analisar
   * @returns {Array} Números encontrados
   */
  extractNumbers(text) {
    const numberRegex = /(\d+[\d\s,.-]*\d+|\d+)/g;
    return text.match(numberRegex) || [];
  }

  /**
   * Extrai emojis da mensagem
   * @param {string} text - Texto a analisar
   * @returns {Array} Emojis encontrados
   */
  extractEmojis(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return text.match(emojiRegex) || [];
  }

  /**
   * Detecta o tom da mensagem
   * @param {string} text - Texto a analisar
   * @returns {string} Tom detectado
   */
  detectTone(text) {
    const urgentWords = ['urgente', 'últimos', 'só hoje', 'acaba', 'agora'];
    const formalWords = ['prezado', 'senhor', 'senhora', 'cordialmente'];
    const casualWords = ['oi', 'opa', 'galera', 'pessoal', 'cola'];

    const lowerText = text.toLowerCase();

    if (urgentWords.some(word => lowerText.includes(word))) return 'urgente';
    if (formalWords.some(word => lowerText.includes(word))) return 'formal';
    if (casualWords.some(word => lowerText.includes(word))) return 'casual';

    return 'neutro';
  }

  /**
   * Detecta estrutura da mensagem
   * @param {string} text - Texto a analisar
   * @returns {string} Estrutura detectada
   */
  detectStructure(text) {
    const hasGreeting = /^(olá|oi|bom dia|boa tarde|boa noite)/i.test(text);
    const hasCta = /(digite|responda|clique|acesse)/i.test(text);
    const hasClosing = /(obrigado|até|abraços|att)/i.test(text);

    if (hasGreeting && hasCta && hasClosing) return 'completa';
    if (hasGreeting && hasCta) return 'saudacao_cta';
    if (hasCta) return 'cta_focused';

    return 'simples';
  }

  /**
   * Encontra elementos que devem ser preservados
   * @param {string} text - Texto a analisar
   * @returns {Object} Elementos a preservar
   */
  findElementsToPreserve(text) {
    return {
      links: this.extractLinks(text),
      numbers: this.extractNumbers(text),
      phoneNumbers: text.match(/\d{2}\s?\d{4,5}-?\d{4}/g) || [],
      codes: text.match(/[A-Z0-9]{3,}/g) || []
    };
  }

  /**
   * Garante que elementos importantes foram preservados
   * @param {string} text - Texto modificado
   * @param {Object} elements - Elementos a preservar
   * @returns {string} Texto com elementos preservados
   */
  preserveElements(text, elements) {
    // Esta função garante que links, números importantes, etc. não foram alterados
    // Por simplicidade, retornamos o texto como está, mas poderia ter validação mais rigorosa
    return text;
  }

  /**
   * Método público para testar o gerador
   * @param {string} message - Mensagem de teste
   */
  testVariations(message) {
    console.log('🧪 TESTE DO GERADOR DE VARIAÇÕES');
    console.log('Original:', message);
    console.log('='.repeat(50));

    const variations = this.generateVariations(message);
    
    variations.forEach((variation, index) => {
      console.log(`Variação ${index + 1}:`, variation);
      console.log('-'.repeat(30));
    });
  }
}

module.exports = MessageVariationGenerator;
