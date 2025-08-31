import { test, expect, describe } from "vitest";
import { LanguageDetectionService } from "../services/language-detection.js";

describe("LanguageDetectionService", () => {
  const languageDetector = new LanguageDetectionService();

  describe("URL-based language detection", () => {
    test("detects French from French domains", () => {
      const article = {
        title: "Sample Article",
        description: "Sample description",
        content: "<p>Sample content</p>",
        url: "https://lemonde.fr/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("french");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });

    test("detects Spanish from Spanish domains", () => {
      const article = {
        title: "Sample Article",
        description: "Sample description", 
        content: "<p>Sample content</p>",
        url: "https://elpais.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("spanish");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });

    test("detects Portuguese from Brazilian domains", () => {
      const article = {
        title: "Sample Article",
        description: "Sample description",
        content: "<p>Sample content</p>", 
        url: "https://globo.com/noticias/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("portuguese");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });

    test("detects Chinese from Chinese domains", () => {
      const article = {
        title: "Sample Article",
        description: "Sample description",
        content: "<p>Sample content</p>",
        url: "https://sina.com.cn/news/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("chinese");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });

    test("detects Japanese from Japanese domains", () => {
      const article = {
        title: "Sample Article",
        description: "Sample description",
        content: "<p>Sample content</p>",
        url: "https://asahi.com/news/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("japanese");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });

    test("detects Arabic from Arabic domains", () => {
      const article = {
        title: "Sample Article",
        description: "Sample description",
        content: "<p>Sample content</p>",
        url: "https://alarabiya.net/news/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("arabic");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });

    test("handles special cases - Al Jazeera English", () => {
      const article = {
        title: "Sample Article",
        description: "Sample description",
        content: "<p>Sample content</p>",
        url: "https://aljazeera.com/news/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("english");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });
  });

  describe("Content-based language detection", () => {
    test("detects English from English content", () => {
      const article = {
        title: "Breaking News: Technology Investment Market Analysis",
        description: "The market shows significant growth in technology investments according to recent reports.",
        content: "<p>Technology companies have been investing heavily in new products and services. The market analysis shows strong growth potential for businesses in the United States and other English-speaking countries.</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("english");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test("detects Spanish from Spanish content", () => {
      const article = {
        title: "Noticias Económicas: Análisis del Mercado de Inversión",
        description: "El mercado muestra un crecimiento significativo en las inversiones tecnológicas según los informes más recientes.",
        content: "<p>Las empresas tecnológicas han estado invirtiendo mucho dinero en nuevos productos y servicios. El análisis del mercado español muestra un potencial de crecimiento sólido para las empresas en España y otros países de habla hispana.</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("spanish");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test("detects French from French content", () => {
      const article = {
        title: "Nouvelles Économiques: Analyse du Marché des Investissements",
        description: "Le marché montre une croissance significative des investissements technologiques selon les rapports récents.",
        content: "<p>Les entreprises technologiques investissent massivement dans de nouveaux produits et services. L'analyse du marché français montre un potentiel de croissance solide pour les entreprises en France et dans d'autres pays francophones.</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("french");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test("detects Portuguese from Portuguese content", () => {
      const article = {
        title: "Notícias Econômicas: Análise do Mercado de Investimento",
        description: "O mercado mostra crescimento significativo em investimentos tecnológicos segundo relatórios recentes.",
        content: "<p>As empresas de tecnologia têm investido muito dinheiro em novos produtos e serviços. A análise do mercado brasileiro mostra potencial de crescimento sólido para empresas no Brasil e outros países lusófonos.</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("portuguese");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test("detects Chinese from Chinese content", () => {
      const article = {
        title: "经济新闻：投资市场分析报告",
        description: "根据最新报告，市场在技术投资方面显示出显著增长，这对中国经济发展具有重要意义。",
        content: "<p>技术公司一直在新产品和服务上投资大量资金。市场分析显示，中国和其他中文国家的企业具有强劲的增长潜力。投资者对新兴技术领域表现出浓厚兴趣，预计未来几年将继续保持这一趋势。</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("chinese");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test("detects Japanese from Japanese content", () => {
      const article = {
        title: "経済ニュース：投資市場分析",
        description: "最近のレポートによると、市場は技術投資において大幅な成長を示している。",
        content: "<p>技術会社は新しい製品とサービスに大きく投資している。市場分析は、日本と他の日本語圏の企業にとって強い成長の潜在性を示している。</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("japanese");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test("detects Arabic from Arabic content", () => {
      const article = {
        title: "الأخبار الاقتصادية: تحليل سوق الاستثمار",
        description: "يظهر السوق نموًا كبيرًا في الاستثمارات التكنولوجية وفقًا للتقارير الأخيرة.",
        content: "<p>تستثمر الشركات التكنولوجية بكثافة في منتجات وخدمات جديدة. يُظهر تحليل السوق إمكانات نمو قوية للشركات في الدول العربية.</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("arabic");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe("HTML content extraction", () => {
    test("extracts text content from HTML and detects language", () => {
      const article = {
        title: "Technology News",
        description: null,
        content: `
          <html>
            <head><title>Technology News</title></head>
            <body>
              <script>console.log('test');</script>
              <style>body { color: red; }</style>
              <h1>Technology Investment Market Analysis</h1>
              <p>The technology market shows significant growth potential according to recent business reports. Companies are investing heavily in new products and services across the United States and other English-speaking countries.</p>
              <div>This is more content about technology and business investment.</div>
            </body>
          </html>
        `,
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("english");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe("Edge cases and fallbacks", () => {
    test("flags minimal content for manual review", () => {
      const article = {
        title: "X",
        description: "Y", 
        content: "Z",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBeNull();
      expect(result.needsManualReview).toBe(true);
      expect(result.method).toBe("insufficient_content");
      expect(result.confidence).toBe(0);
    });

    test("flags empty content for manual review", () => {
      const article = {
        title: "",
        description: null,
        content: null,
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBeNull();
      expect(result.needsManualReview).toBe(true);
      expect(result.method).toBe("insufficient_content");
      expect(result.confidence).toBe(0);
    });

    test("prioritizes URL detection over content detection", () => {
      const article = {
        title: "Noticias en Español: Análisis del Mercado",
        description: "Este es contenido en español con muchas palabras españolas como tecnología, empresa, economía, mercado, inversión.",
        content: "<p>Más contenido en español sobre empresas y tecnología en España.</p>",
        url: "https://lemonde.fr/article/123" // French domain
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      // URL detection should take priority
      expect(result.detectedLanguage).toBe("french");
      expect(result.method).toBe("url");
      expect(result.confidence).toBe(0.85);
    });

    test("handles articles with null/undefined fields", () => {
      const article = {
        title: "Technology Investment Market Analysis Report for Business Growth and Development Strategies",
        description: null,
        content: undefined,
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      // Should still detect from title if sufficient content
      expect(result.detectedLanguage).toBe("english");
      expect(result.needsManualReview).toBe(false);
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe("Mixed content scenarios", () => {
    test("handles mixed language content with English dominance", () => {
      const article = {
        title: "Technology News with some español words but mostly English content for testing purposes",
        description: "This article contains primarily English content with technology, investment, market, business, company, and analysis terms for comprehensive language detection testing.",
        content: "<p>The technology market shows significant growth in recent years according to business reports. Companies are investing in new products and services across multiple industries. Some palabras en español but mainly English business analysis and market research data for comprehensive testing.</p>",
        url: "https://unknown-domain.com/article/123"
      };

      const result = languageDetector.detectArticleLanguage(article);
      
      expect(result.detectedLanguage).toBe("english");
      expect(result.method).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe("Service utility methods", () => {
    test("getSupportedLanguages returns expected languages", () => {
      const languages = languageDetector.getSupportedLanguages();
      
      expect(languages).toEqual([
        'english', 'spanish', 'arabic', 'portuguese', 
        'french', 'chinese', 'japanese'
      ]);
      expect(languages).toHaveLength(7);
    });
  });
});