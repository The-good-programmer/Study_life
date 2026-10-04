import type { AcademicGradeLevel, ConceptDepthEstimate, DepthTier, GradeLevelOption, SupportedLanguage, StudySession, ConceptCheckpoint, RetrievalCard } from '../types';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
];

export const GRADE_LEVEL_OPTIONS: GradeLevelOption[] = [
  {
    level: 'elementary',
    label: 'Elementary (1st-5th Grade)',
    badge: '🎒 4th Grader Mode',
    ageRange: 'Ages 7–11',
    description: 'Everyday analogies, simple words, observable phenomena, zero dense jargon.',
  },
  {
    level: 'middle-school',
    label: 'Middle School (6th-8th Grade)',
    badge: '🏫 Middle School',
    ageRange: 'Ages 11–14',
    description: 'Foundational scientific mechanisms, core terms, structured cause-and-effect.',
  },
  {
    level: 'high-school',
    label: 'High School (9th-12th Grade)',
    badge: '🎓 9th Grader Mode',
    ageRange: 'Ages 14–18',
    description: 'Secondary curriculum, causal depth, standard formulas, AP/curriculum standards.',
  },
  {
    level: 'college',
    label: 'College / University',
    badge: '🏛️ University',
    ageRange: 'Undergrad / AP',
    description: 'Rigorous theoretical formulations, quantitative derivations, biochemical/physical details.',
  },
  {
    level: 'specialist',
    label: 'Specialist / Board Review',
    badge: '🔬 Advanced Specialist',
    ageRange: 'Graduate / Medical',
    description: 'Multi-system synthesis, boundary conditions, edge cases, failure modes, counter-examples.',
  },
];

export class DepthEstimationService {
  /**
   * Fast, zero-network language detector analyzing Unicode scripts and high-frequency functional stopwords
   */
  public static detectLanguage(text: string): SupportedLanguage {
    if (!text || !text.trim()) {
      return SUPPORTED_LANGUAGES[0]; // English default
    }

    const trimmed = text.trim();

    // 1. Script-based Unicode detection
    if (/[\u0600-\u06FF\u0750-\u077F]/.test(trimmed)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'ar') || SUPPORTED_LANGUAGES[0];
    }
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(trimmed)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'ja') || SUPPORTED_LANGUAGES[0];
    }
    if (/[\u4E00-\u9FFF]/.test(trimmed)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'zh') || SUPPORTED_LANGUAGES[0];
    }

    // 2. Diacritics and unique alphabetic characters
    const lower = trimmed.toLowerCase();
    
    // Turkish unique characters: ğ, ü, ş, ö, ç, ı
    if (/[ğüşöçı]/.test(lower)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'tr') || SUPPORTED_LANGUAGES[0];
    }
    // German unique characters: ä, ö, ü, ß
    if (/[äöüß]/.test(lower) && !/[ğşç]/.test(lower)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'de') || SUPPORTED_LANGUAGES[0];
    }
    // Spanish unique characters: ñ, ¿, ¡, or á, é, í, ó, ú
    if (/[ñ¿¡]/.test(lower)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'es') || SUPPORTED_LANGUAGES[0];
    }
    // French unique ligature/accents: œ, æ, è, ê, ë, à, â, ç, ù, û
    if (/[œæèêëàâçùû]/.test(lower)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'fr') || SUPPORTED_LANGUAGES[0];
    }
    // Portuguese tildes: ã, õ
    if (/[ãõ]/.test(lower)) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'pt') || SUPPORTED_LANGUAGES[0];
    }

    // 3. Stop-word token frequency matching for Latin scripts
    const tokens = lower.split(/\s+/).map(t => t.replace(/[^a-z0-9]/gi, '')).filter(Boolean);

    const stopwordsTR = new Set(['ve', 'bir', 'icin', 'için', 'ile', 'nasil', 'nasıl', 'nedir', 'bu', 'su', 'şu', 'de', 'da', 'ne', 'cok', 'çok', 'olan', 'gibi', 'mi', 'mu', 'kadar']);
    const stopwordsES = new Set(['el', 'la', 'de', 'en', 'y', 'que', 'del', 'los', 'las', 'un', 'una', 'como', 'cómo', 'por', 'para', 'con', 'sobre', 'es', 'son']);
    const stopwordsDE = new Set(['der', 'die', 'das', 'und', 'fuer', 'für', 'wie', 'ist', 'ein', 'eine', 'nicht', 'zu', 'mit', 'von', 'ueber', 'über', 'den', 'dem']);
    const stopwordsFR = new Set(['le', 'la', 'les', 'de', 'et', 'en', 'pour', 'un', 'une', 'dans', 'comment', 'est', 'sur', 'des', 'du', 'avec']);
    const stopwordsIT = new Set(['il', 'la', 'di', 'e', 'in', 'per', 'un', 'una', 'del', 'con', 'come', 'su', 'sono', 'non', 'ed', 'della']);
    const stopwordsPT = new Set(['o', 'a', 'de', 'e', 'do', 'da', 'em', 'um', 'uma', 'para', 'como', 'por', 'com', 'nao', 'não', 'dos', 'das']);

    let trHits = 0;
    let esHits = 0;
    let deHits = 0;
    let frHits = 0;
    let itHits = 0;
    let ptHits = 0;

    for (const t of tokens) {
      if (stopwordsTR.has(t)) trHits++;
      if (stopwordsES.has(t)) esHits++;
      if (stopwordsDE.has(t)) deHits++;
      if (stopwordsFR.has(t)) frHits++;
      if (stopwordsIT.has(t)) itHits++;
      if (stopwordsPT.has(t)) ptHits++;
    }

    const maxHits = Math.max(trHits, esHits, deHits, frHits, itHits, ptHits);
    if (maxHits > 0) {
      if (maxHits === trHits) return SUPPORTED_LANGUAGES.find(l => l.code === 'tr') || SUPPORTED_LANGUAGES[0];
      if (maxHits === esHits) return SUPPORTED_LANGUAGES.find(l => l.code === 'es') || SUPPORTED_LANGUAGES[0];
      if (maxHits === deHits) return SUPPORTED_LANGUAGES.find(l => l.code === 'de') || SUPPORTED_LANGUAGES[0];
      if (maxHits === frHits) return SUPPORTED_LANGUAGES.find(l => l.code === 'fr') || SUPPORTED_LANGUAGES[0];
      if (maxHits === itHits) return SUPPORTED_LANGUAGES.find(l => l.code === 'it') || SUPPORTED_LANGUAGES[0];
      if (maxHits === ptHits) return SUPPORTED_LANGUAGES.find(l => l.code === 'pt') || SUPPORTED_LANGUAGES[0];
    }

    // Default to English
    return SUPPORTED_LANGUAGES[0];
  }

  /**
   * Estimates cognitive depth (Webb DOK 1-4, score 1-10) without any uploaded document
   */
  public static estimateConceptDepth(
    rawTopic: string,
    targetLanguageCode?: string
  ): ConceptDepthEstimate {
    const topic = rawTopic.trim();
    if (!topic) {
      return {
        score: 3,
        tier: 'foundational',
        gradeLevel: 'high-school',
        gradeLabel: '🎓 9th Grader Mode',
        recommendedCheckpoints: 2,
        estimatedMinutes: 15,
        domain: 'General Fundamentals',
        reasoning: 'Introductory primer on core concepts.',
        detectedKeywords: [],
      };
    }

    const lower = topic.toLowerCase();
    const words = lower.split(/[\s,.:;/\-_+]+/).filter(w => w.length > 1);
    const wordCount = words.length;

    // Detect keywords and morphological patterns
    const detectedKeywords: string[] = [];

    // Explicit Grade Cue Detection across multiple languages
    const elementaryGradeRegex = /\b(4th grade|grade 4|1st grade|2nd grade|3rd grade|5th grade|elementary|primary school|for kids|for children|beginner|4\.\s*sınıf|4\.sınıf|ilkokul|çocuklar için|primaria|4[ºo]\s*grado|para niños|grundschule|4\.\s*klasse|primaire|cm1|cm2)\b/i;
    const middleSchoolGradeRegex = /\b(6th grade|7th grade|8th grade|middle school|junior high|ortaokul|6\.\s*sınıf|7\.\s*sınıf|8\.\s*sınıf|lgs|secundaria|collège|realschule|mittelstufe|6\.\s*klasse|7\.\s*klasse|8\.\s*klasse)\b/i;
    const highSchoolGradeRegex = /\b(9th grade|grade 9|10th grade|11th grade|12th grade|high school|freshman|sophomore|secondary school|lise|9\.\s*sınıf|9\.sınıf|10\.\s*sınıf|11\.\s*sınıf|12\.\s*sınıf|tyt|bachillerato|9[ºo]\s*grado|gymnasium|9\.\s*klasse|10\.\s*klasse|oberstufe|lycée)\b/i;
    const collegeGradeRegex = /\b(college|university|undergrad|undergraduate|ap biology|ap physics|ap chemistry|ap calculus|üniversite|ayt|lisans|universidad|facultad|universität|hochschule)\b/i;
    const specialistGradeRegex = /\b(graduate|phd|postgrad|postgraduate|specialist|expert|olympiad|usmle|mcat|board review|tus|doktora|yüksek lisans|olimpiyat|investigación)\b/i;

    // High Cognitive Load Keywords (Score weight: 8 - 10)
    const specialistRegex = /\b(quantum|kuantum|cu[aá]ntic[ao]|quanten|relativit[ye]|relatividad|electrodynamics|elektrodinamik|thermodynamics|termodinamik|thermodynamik|epigenetics|epigenetik|neurobiology|n[oö]robiyoloji|neurobiolog[ií]a|electrophysiology|elektrofizyoloji|tensor|stochastic|stochastisch|estoc[aá]stico|schrodinger|schrödinger|heisenberg|hamiltonian|lagrangian|fourier|laplace|navier-stokes|crispr|single-cell|pharmacokinetics|farmakokinetik|pathophysiology|patofizyoloji|immunology|imm[uü]noloj[ií]|diferansiyel|differential|diff[eé]rentiel|topology|topoloji|topolog[ií]a|cryptography|kriptografi|kripto|astrophysics|astrofizik)\b/i;

    // Intermediate Cognitive Load Keywords (Score weight: 4 - 7)
    const intermediateRegex = /\b(photosynthesis|fotosentez|fotos[ií]ntesis|mitosis|mayoz|meiosis|kinetics|kinetik|cin[eé]tica|enzyme|enzim|enzima|respiration|solunum|respiraci[oó]n|equilibrium|denge|equilibrio|gleichgewicht|membrane|zar|membrana|action potential|aksiyon potansiyeli|potencial de acci[oó]n|genetics|genetik|gen[eé]tica|osmosis|osmoz|[oó]smosis|calculus|kalk[uü]l[uü]s|c[aá]lculo|microeconomics|mikroiktisat|microeconom[ií]a|macroeconomics|makroiktisat|macroeconom[ií]a|supply and demand|arz ve talep|oferta y demanda|newton|galileo|mendel|krebs|glycolysis|glikoliz|glic[oó]lisis|derivative|t[uü]rev|derivada|integral|matrix|matris|matriz|recursion|rek[uü]rsiyon|recursi[oó]n|algorithm|algoritma|algoritmo)\b/i;

    // Foundational / Elementary Keywords (Score weight: 1 - 3)
    const foundationalRegex = /\b(atom|atomo|átomo|cell|h[uü]cre|c[eé]lula|zelle|water cycle|su d[oö]ng[uü]s[uü]|ciclo del agua|gravity|yer[cç]ekimi|gravedad|schwerkraft|fraction|kesir|fracci[oó]n|bruch|addition|toplama|suma|multiplication|[cç]arpma|multiplicaci[oó]n|money|para|dinero|geld|democracy|demokrasi|democracia|demokratie|verb|fiil|verbo|noun|isim|sustantivo|light|isik|ışık|luz|licht|sound|ses|sonido|schall|magnet|mıknatıs|im[aá]n)\b/i;

    // Morphological Suffixes indicating systemic/theoretical complexity
    const highDensitySuffixRegex = /(dynamics|dinamik|kinetics|kinetik|genesis|synthesis|sentez|differentiation|farklılaşma|differentiation|electrophoresis|spektrometre|spektroskopie|spectroscopy|mechanics|mekanik|mechanik|theory|teori|theorie|teoría)$/i;

    let baseScore = 4; // Start at balanced standard (DOK 2)
    let domain = 'Applied Concepts';

    // 1. Keyword matching
    if (specialistRegex.test(lower)) {
      baseScore += 4;
      domain = 'Advanced Rigor & Theoretical Mechanics';
      const matches = lower.match(specialistRegex);
      if (matches) detectedKeywords.push(matches[0]);
    } else if (intermediateRegex.test(lower)) {
      baseScore += 2;
      domain = 'Structured Academic Curriculum';
      const matches = lower.match(intermediateRegex);
      if (matches) detectedKeywords.push(matches[0]);
    } else if (foundationalRegex.test(lower)) {
      baseScore -= 2;
      domain = 'Foundational Mental Models';
      const matches = lower.match(foundationalRegex);
      if (matches) detectedKeywords.push(matches[0]);
    }

    // 2. Morphological suffix scan
    for (const w of words) {
      if (highDensitySuffixRegex.test(w)) {
        baseScore += 1.5;
        detectedKeywords.push(w);
      }
    }

    // 3. Structural compound breadth (multi-word specific curriculum topics)
    if (wordCount >= 4) {
      baseScore += 1.5;
    } else if (wordCount === 1 && !specialistRegex.test(lower)) {
      baseScore -= 0.5;
    }

    // 4. Grade cue adjustments
    let gradeLevel: AcademicGradeLevel = 'high-school';
    if (elementaryGradeRegex.test(lower)) {
      gradeLevel = 'elementary';
      baseScore = Math.min(baseScore, 3);
      domain = 'Elementary School (4th Grader Mode)';
    } else if (middleSchoolGradeRegex.test(lower)) {
      gradeLevel = 'middle-school';
      baseScore = 4;
      domain = 'Middle School (6th-8th Grade)';
    } else if (highSchoolGradeRegex.test(lower)) {
      gradeLevel = 'high-school';
      baseScore = Math.max(5, baseScore);
      domain = 'High School (9th Grader Mode)';
    } else if (collegeGradeRegex.test(lower)) {
      gradeLevel = 'college';
      baseScore = Math.max(7, baseScore);
      domain = 'College / University Undergrad';
    } else if (specialistGradeRegex.test(lower)) {
      gradeLevel = 'specialist';
      baseScore = Math.max(9, baseScore);
      domain = 'Specialist / Advanced Exam Review';
    } else {
      // Inferred from intrinsic topic complexity
      if (specialistRegex.test(lower) || baseScore >= 8) {
        gradeLevel = baseScore >= 9 ? 'specialist' : 'college';
      } else if (foundationalRegex.test(lower) || baseScore <= 3) {
        gradeLevel = 'elementary';
      } else if (baseScore <= 4.5) {
        gradeLevel = 'middle-school';
      } else {
        gradeLevel = 'high-school'; // default secondary curriculum (9th grade)
      }
    }

    // Clamp score strictly between 1 and 10
    const finalScore = Math.min(10, Math.max(1, Math.round(baseScore)));

    let tier: DepthTier = 'standard';
    let recommendedCheckpoints = 3;
    let estimatedMinutes = 35;
    let reasoning = 'Balanced academic breakdown covering mechanisms and standard applications.';

    if (gradeLevel === 'elementary' || finalScore <= 3) {
      tier = 'foundational';
      recommendedCheckpoints = 2;
      estimatedMinutes = 15;
      reasoning = '4th Grader friendly: Everyday analogies, simple vocabulary, fun visual storytelling, zero dense jargon.';
    } else if (gradeLevel === 'specialist' || finalScore >= 8) {
      tier = 'deep-dive';
      recommendedCheckpoints = 5;
      estimatedMinutes = 65;
      reasoning = 'University/Specialist level: Multi-stage synthesis covering mathematical/mechanistic rigor, boundary limits, and edge cases.';
    } else {
      tier = 'standard';
      recommendedCheckpoints = finalScore >= 6 ? 4 : 3;
      estimatedMinutes = finalScore >= 6 ? 45 : 35;
      reasoning = '9th Grader / High School curriculum: Cause-and-effect relationships, governing formulas, and exam prep.';
    }

    // Detect language if not provided
    const lang = targetLanguageCode 
      ? (SUPPORTED_LANGUAGES.find(l => l.code === targetLanguageCode) || this.detectLanguage(topic))
      : this.detectLanguage(topic);

    const gradeOpt = GRADE_LEVEL_OPTIONS.find(g => g.level === gradeLevel) || GRADE_LEVEL_OPTIONS[2];

    return {
      score: finalScore,
      tier,
      gradeLevel,
      gradeLabel: gradeOpt.badge,
      recommendedCheckpoints,
      estimatedMinutes,
      domain: `${lang.nativeName} • ${gradeOpt.badge} • ${domain}`,
      reasoning,
      detectedKeywords: Array.from(new Set(detectedKeywords)),
    };
  }

  /**
   * Synthesizes a 100% offline, localized study session adapted to depth tier and language
   */
  public static synthesizeLocalizedStudySession(
    topicInput: string,
    isRawNotes: boolean,
    sessionId: string,
    depthTier: DepthTier = 'standard',
    languageCode: string = 'en',
    gradeLevel: AcademicGradeLevel = 'high-school'
  ): StudySession {
    const rawClean = topicInput.trim();
    const title = isRawNotes
      ? (rawClean.split('\n')[0]?.slice(0, 45).replace(/[#*_-]/g, '').trim() || 'Study Notes Breakdown')
      : rawClean;

    const langCode = (languageCode || 'en').toLowerCase().slice(0, 2);

    // Number of checkpoints based on depth tier
    const checkpointCount = depthTier === 'foundational' || gradeLevel === 'elementary' ? 2 : depthTier === 'deep-dive' ? 4 : 3;

    const concepts: ConceptCheckpoint[] = [];

    // Helper to build a RetrievalCard
    const makeCard = (
      conceptId: string,
      cardIndex: number,
      cardType: 'standard' | 'cloze' | 'multiple-choice',
      q: string,
      a: string,
      hint: string,
      explanation: string,
      options?: string[],
      clozeTemplate?: string
    ): RetrievalCard => ({
      id: `rc-${conceptId}-${cardIndex}`,
      conceptId,
      cardType,
      question: q,
      answer: a,
      hint,
      explanation,
      options,
      clozeTemplate: clozeTemplate || (q.includes('{{') ? q : undefined),
      stability: 1,
      difficulty: 4,
      reps: 0,
      lapses: 0,
    });

    // Localized generators for CP1 (Foundations), CP2 (Dynamics), CP3 (Boundaries), CP4 (Synthesis)
    switch (langCode) {
      case 'tr': {
        // --- TURKISH (TR) ---
        // CP 1: Temel Prensipler
        const c1Id = `c-${sessionId}-1`;
        concepts.push({
          id: c1Id,
          order: 1,
          title: `${title}: Temel İlkeler ve Çekirdek Yapı`,
          estimatedMinutes: 12,
          mentalModel: `${title}, belirli kurallar ve girdiler doğrultusunda tutarlı sonuçlar üreten birbirine bağlı bir sistemdir.`,
          coreTakeaways: [
            `${title} konusunun birincil amacı, girdileri ve temel kuralları koordine ederek öngörülebilir çıktılar üretmektir.`,
            `Ezberlemek yerine ${title} içindeki neden-sonuç dinamiklerini kavramak kalıcı öğrenmenin anahtarıdır.`,
            `Temel bileşenler standart çalışma şartlarında dengeli ve kararlı bir yapı sergiler.`
          ],
          keyTerms: [
            { term: 'Temel Mekanizma', definition: `${title} sisteminin çalışmasını sağlayan birincil fonksiyonel motor.` },
            { term: 'Nedensel Değişmez', definition: `${title} yapısında standart şartlarda geçerliliğini koruyan ana kural.` }
          ],
          feynmanPrompt: `${title} kavramının en temel mantığını 12 yaşındaki birine hiç yabancı teknik terim kullanmadan nasıl açıklarsın?`,
          sampleMasteryExplanation: `${title}, özünde girdileri alıp temel kurallar işleterek istenen çıktıyı sürtünmesiz ve tutarlı şekilde üreten bir yapıdır.`,
          retrievalCards: [
            makeCard(c1Id, 1, 'standard', `${title} sisteminin temel varoluş amacı ve ana çalışma mekanizması nedir?`, `Girdileri ve temel kuralları koordine ederek öngörülebilir, yapılandırılmış sonuçlar üretmek.`, 'Girdilerin nasıl çıktıya dönüştüğüne odaklanın.', 'Aktif hatırlama temel ilkeler arasındaki nöral bağlantıları güçlendirir.'),
            makeCard(c1Id, 2, 'cloze', `${title} analiz edilirken salt terimleri ezberlemek yerine {{altta yatan nedensel mekanizmayı}} anlamak esastır.`, 'altta yatan nedensel mekanizmayı', 'İşleyişi sağlayan ana fonksiyonel motor.', 'Neden-sonuç zincirine odaklanmak yetkinlik yanılsamasını engeller.'),
            makeCard(c1Id, 3, 'multiple-choice', `${title} sisteminin temel davranışlarını incelerken en verimli yaklaşım hangisidir?`, 'Bileşenler arasındaki neden-sonuç ilişkilerini dekonstrükte etmek', 'İlk prensiplerle düşünme yöntemini hatırlayın.', 'Girdiden çıktıya giden zinciri takip etmek kalıcı zihinsel modeller inşa eder.', [
              'Bileşenler arasındaki neden-sonuç ilişkilerini dekonstrükte etmek',
              'Terimleri aralarındaki bağları anlamadan ezberlemek',
              'Sistemin hiçbir kurala tabi olmadığını varsaymak',
              'Sadece yüzeysel semptomlara odaklanmak'
            ])
          ]
        });

        // CP 2: İşleyiş Dinamikleri
        const c2Id = `c-${sessionId}-2`;
        concepts.push({
          id: c2Id,
          order: 2,
          title: `${title}: İşleyiş Dinamikleri ve Sistem Etkileşimi`,
          estimatedMinutes: 14,
          mentalModel: `${title} içerisindeki alt parçaların bir dişli gibi birbirini tetikleyerek yarattığı dinamik akış.`,
          coreTakeaways: [
            `${title} sürecinde her aşama, bir sonraki aşamanın tetikleyicisi olarak işlev görür.`,
            `Enerji, bilgi veya kaynak akışındaki engeller tüm sistemin verimini doğrudan etkiler.`,
            `Geri besleme (feedback) mekanizmaları dengenin korunmasında hayati rol oynar.`
          ],
          keyTerms: [
            { term: 'Dinamik Akış', definition: `${title} bileşenleri arasında süreklilik arz eden etkileşim zinciri.` },
            { term: 'Geri Besleme Döngüsü', definition: 'Sistemin kendi çıktısını girdi olarak kullanarak dengelenme yeteneği.' }
          ],
          feynmanPrompt: `${title} sürecinde bir parça aksarsa tüm sistemin nasıl etkileneceğini bir domino taşı benzetmesiyle anlat.`,
          sampleMasteryExplanation: `Her bileşen bir öncekine bağlıdır; akıştaki tek bir darboğaz, zincirleme reaksiyonla tüm çıktıyı yavaşlatır veya bozar.`,
          retrievalCards: [
            makeCard(c2Id, 1, 'standard', `${title} mekanizmasında bir alt bileşenin bozulması neden tüm sistemi etkiler?`, `Çünkü bileşenler ardışık ve birbirine bağımlı bir nedensellik zinciriyle bağlıdır.`, 'Zincirleme reaksiyonu düşünün.', 'Sistemik düşünce, izole parçalar yerine bağlantıları analiz etmeyi öğretir.'),
            makeCard(c2Id, 2, 'cloze', `${title} sisteminde sürekliliği sağlayan ve sapmaları düzelten yapı {{geri besleme döngüsüdür}}.`, 'geri besleme döngüsüdür', 'Çıktıyı kontrol edip sistemi regüle eden mekanizma.', 'Regülasyonu kavramak derin ustalığın göstergesidir.'),
            makeCard(c2Id, 3, 'multiple-choice', `${title} sürecinde kritik bir darboğaz meydana geldiğinde ne gözlemlenir?`, 'Tüm sistemin verimi en yavaş aşamanın kapasitesiyle sınırlanır', 'Darboğaz teorisini (Theory of Constraints) göz önünde bulundurun.', 'Sistem hızı en zayıf halkanın hızına eşittir.', [
              'Tüm sistemin verimi en yavaş aşamanın kapasitesiyle sınırlanır',
              'Sistem kendiliğinden sonsuz verimlilik moduna geçer',
              'Darboğaz sadece teoride mevcuttur, pratikte çıktıyı etkilemez',
              'Diğer tüm bileşenler bağımsız olarak hızlanır'
            ])
          ]
        });

        // CP 3: Sınır Koşulları (Standard & Deep-dive)
        if (checkpointCount >= 3) {
          const c3Id = `c-${sessionId}-3`;
          concepts.push({
            id: c3Id,
            order: 3,
            title: `${title}: Sınır Koşulları ve Hata/Limit Durumları`,
            estimatedMinutes: 15,
            mentalModel: `${title} modelinin sınırlarını zorlamak: Baskı, ölçek ve kaynak kısıtları altında sistemin nasıl davrandığı.`,
            coreTakeaways: [
              `${title} prensiplerini gerçek dünyaya uygularken teorik varsayımların nerede çöktüğünü bilmek zorunludur.`,
              `Aşırı yük veya kısıtlı kaynak durumunda sistem doğrusal olmayan tepkiler verir.`,
              `Sınır koşullarını doğru tayin etmek, olası sistemik çöküşleri öngörmeyi sağlar.`
            ],
            keyTerms: [
              { term: 'Sınır Koşulu', definition: `${title} modelinin geçerliliğini yitirdiği veya kırılma yaşadığı eşik değer.` },
              { term: 'Kritik Eşik', definition: 'Sistemin yeni bir denge durumuna geçtiği ya da çöktüğü hassas sınır noktası.' }
            ],
            feynmanPrompt: `${title} prensibinin tamamen geçersiz kaldığı veya çöktüğü bir senaryoyu ve hangi kısıtın aşıldığını açıkla.`,
            sampleMasteryExplanation: `Sistemik hatalar genellikle varsayımların sınırları aşıldığında gerçekleşir; ustalık bu limitleri önceden öngörebilmektir.`,
            retrievalCards: [
              makeCard(c3Id, 1, 'standard', `${title} modelinde sınır koşullarını belirlemek neden kritik bir öneme sahiptir?`, `Çünkü çalışma limitleri aşıldığında sistemik varsayımlar çöker ve öngörülemez davranışlar başlar.`, 'Varsayımlar tükendiğinde ne olur?', 'Limit durumlarını bilmek hataları önler.'),
              makeCard(c3Id, 2, 'cloze', `${title} karmaşık koşullarda test edilirken sistemin çökmemesi için {{sınır kısıtları}} sürekli izlenmelidir.`, 'sınır kısıtları', 'Kuralların değiştiği kritik parametre limitleri.', 'Eşik değerleri takip etmek uzmanlığı yüzey öğrenmeden ayırır.'),
              makeCard(c3Id, 3, 'multiple-choice', `${title} prensibini sınır koşullarını dikkate almadan uygulamanın en büyük riski nedir?`, 'Çalışma varsayımları aşıldığında sistemin beklenmedik şekilde çökmesi', 'Stres testlerini düşünün.', 'Sınırları tanımak gerçek dünya başarısının anahtarıdır.', [
                'Çalışma varsayımları aşıldığında sistemin beklenmedik şekilde çökmesi',
                'Matematiksel modellerin her koşulda kusursuz çalışması',
                'Sınırların yalnızca teorik ders kitaplarında önem taşıması',
                'Ölçek büyüdükçe hiçbir kuralın değişmemesi'
              ])
            ]
          });
        }

        // CP 4: İleri Düzey Sentez (Deep-dive only)
        if (checkpointCount >= 4) {
          const c4Id = `c-${sessionId}-4`;
          concepts.push({
            id: c4Id,
            order: 4,
            title: `${title}: İleri Düzey Sentez ve Sistem Entegrasyonu`,
            estimatedMinutes: 20,
            mentalModel: `${title} konusunun komşu disiplinlerle ve makro sistemlerle entegrasyonu; paradokslar ve karşı-sezgisel mekanizmalar.`,
            coreTakeaways: [
              `${title} izole bir ada değildir; daha büyük hiyerarşik yapıların alt mekanizmasıdır.`,
              `İleri seviye problemlerde karşı-sezgisel sonuçlar ve ikinci dereceden etkiler (second-order effects) baskındır.`,
              `Teorik mükemmellik ile pratik optimizasyon arasındaki ödünleşimleri (trade-offs) yönetmek gerekir.`
            ],
            keyTerms: [
              { term: 'İkinci Dereceden Etki', definition: 'İlk aksiyonun doğrudan sonucu değil, o sonucun yarattığı dolaylı sistemik tepki.' },
              { term: 'Sistemik Entegrasyon', definition: `${title} yapısının daha geniş ekosistem veya kuramlarla uyum içinde çalışması.` }
            ],
            feynmanPrompt: `${title} ile ilgili ilk bakışta mantığa aykırı (karşı-sezgisel) gelen bir durumu ve bunun arkasındaki gizli mekanizmayı açıkla.`,
            sampleMasteryExplanation: `İleri düzeyde sistem doğrudan tepkiler yerine dolaylı zincirleme dengeler üretir; gerçek ustalık bu ikinci dereceden etkileri hesaplayabilmektir.`,
            retrievalCards: [
              makeCard(c4Id, 1, 'standard', `${title} ileri seviyede incelenirken ikinci dereceden etkileri hesaplamak neden zorunludur?`, `Çünkü doğrudan sonuçlar olumlu görünse bile dolaylı reaksiyonlar sistemi beklenmedik şekilde kararsızlaştırabilir.`, 'Görünmeyen zincirleme sonuçları hesaba katın.', 'Usta öğreniciler görünürün ötesindeki sistemik yankıları modeller.'),
              makeCard(c4Id, 2, 'cloze', `${title} ileri analizinde, ilk müdahalenin tetiklediği dolaylı sonuçlara {{ikinci dereceden etkiler}} denir.`, 'ikinci dereceden etkiler', 'Doğrudan olmayan sistemik dalgalanmalar.', 'İkinci dereceden düşünme derin kavrayışın temelidir.'),
              makeCard(c4Id, 3, 'multiple-choice', `${title} uzmanı bir araştırmacıyı acemi bir öğrenciden ayıran temel nitelik nedir?`, 'İkinci dereceden etkileri ve sistemik ödünleşimleri öngörebilme yeteneği', 'Sistemik düşünce ve sentez seviyesini hatırlayın.', 'Sentez Bloom taksonomisinin en üst basamağıdır.', [
                'İkinci dereceden etkileri ve sistemik ödünleşimleri öngörebilme yeteneği',
                'Yalnızca ilk akla gelen basit tanımları hızlıca telaffuz edebilmek',
                'Sistemde hiçbir ödünleşimin (trade-off) bulunmadığını iddia etmek',
                'Tüm problemlerin tek bir formülle çözülebileceğine inanmak'
              ])
            ]
          });
        }
        break;
      }

      case 'es': {
        // --- SPANISH (ES) ---
        const c1Id = `c-${sessionId}-1`;
        concepts.push({
          id: c1Id,
          order: 1,
          title: `${title}: Fundamentos y Mecanismos Básicos`,
          estimatedMinutes: 12,
          mentalModel: `${title} es un sistema interconectado donde las entradas y los principios rectores producen resultados estructurados y predecibles.`,
          coreTakeaways: [
            `El propósito fundamental de ${title} es coordinar componentes y reglas operativas para generar resultados estables.`,
            `Comprender las relaciones de causa y efecto en ${title} es mucho más duradero que memorizar términos aislados.`,
            `Los componentes clave mantienen un comportamiento constante bajo condiciones normales de funcionamiento.`
          ],
          keyTerms: [
            { term: 'Mecanismo Operativo', definition: `El motor funcional principal que impulsa el comportamiento de ${title}.` },
            { term: 'Invariante Causal', definition: `La regla fundamental de ${title} que se mantiene bajo circunstancias normales.` }
          ],
          feynmanPrompt: `Explica el concepto fundamental de ${title} a una persona de 12 años sin usar jerga técnica complicada.`,
          sampleMasteryExplanation: `En esencia, ${title} toma entradas básicas, aplica reglas coherentes y produce un resultado optimizado sin fricciones innecesarias.`,
          retrievalCards: [
            makeCard(c1Id, 1, 'standard', `¿Cuál es el propósito fundamental y el mecanismo rector detrás de ${title}?`, `Coordinar entradas y leyes operativas para producir resultados predecibles y estructurados.`, 'Enfócate en cómo las entradas se transforman en salidas.', 'La recuperación activa refuerza las vías neuronales de los principios fundamentales.'),
            makeCard(c1Id, 2, 'cloze', `Al analizar ${title}, la verdadera comprensión requiere entender {{el mecanismo causal subyacente}} en lugar de memorizar datos superficiales.`, 'el mecanismo causal subyacente', 'El motor funcional que hace que todo suceda.', 'Centrarse en causa y efecto previene la ilusión de competencia.'),
            makeCard(c1Id, 3, 'multiple-choice', `¿Qué enfoque es más efectivo para dominar los fundamentos de ${title}?`, 'Descomponer las relaciones de causa y efecto entre sus componentes clave', 'Razonamiento basado en primeros principios.', 'Construir modelos mentales requiere trazar conexiones causales.', [
              'Descomponer las relaciones de causa y efecto entre sus componentes clave',
              'Memorizar vocabulario de forma aislada sin entender las interacciones',
              'Asumir que el sistema funciona sin ninguna restricción o regla',
              'Enfocarse únicamente en síntomas superficiales'
            ])
          ]
        });

        const c2Id = `c-${sessionId}-2`;
        concepts.push({
          id: c2Id,
          order: 2,
          title: `${title}: Dinámica Operativa e Interacciones del Sistema`,
          estimatedMinutes: 14,
          mentalModel: `Una cadena de engranajes donde cada fase de ${title} activa y condiciona la siguiente etapa.`,
          coreTakeaways: [
            `En ${title}, cada etapa actúa como el desencadenante de la fase siguiente.`,
            `Cualquier restricción en el flujo de recursos reduce la eficiencia de todo el sistema.`,
            `Los bucles de retroalimentación estabilizan el equilibrio ante perturbaciones externas.`
          ],
          keyTerms: [
            { term: 'Flujo Dinámico', definition: `La secuencia continua de interacciones funcionales entre los elementos de ${title}.` },
            { term: 'Bucle de Retroalimentación', definition: 'Mecanismo que utiliza la salida del sistema para regular sus propias entradas.' }
          ],
          feynmanPrompt: `¿Cómo afecta un fallo en un componente al resto de ${title}? Explícalo usando una analogía cotidiana.`,
          sampleMasteryExplanation: `Los componentes están encadenados; un solo cuello de botella restringe la tasa global de producción de todo el sistema.`,
          retrievalCards: [
            makeCard(c2Id, 1, 'standard', `¿Por qué un cuello de botella en ${title} limita el rendimiento de todo el sistema?`, `Porque los componentes operan en una secuencia interdependiente donde la velocidad global depende de la fase más lenta.`, 'Aplica la teoría de restricciones.', 'El rendimiento sistémico siempre está ligado a la fase crítica.'),
            makeCard(c2Id, 2, 'cloze', `En el sistema de ${title}, la estabilidad frente a perturbaciones se mantiene mediante {{bucles de retroalimentación}}.`, 'bucles de retroalimentación', 'Mecanismo de autorregulación del sistema.', 'Comprender la regulación es el núcleo del pensamiento sistémico.'),
            makeCard(c2Id, 3, 'multiple-choice', `¿Qué sucede cuando se altera un paso crítico en la cadena operativa de ${title}?`, 'La eficiencia total se ve restringida por la capacidad de la etapa más lenta', 'Considera el efecto dominó en el sistema.', 'Las interconexiones determinan el resultado global.', [
              'La eficiencia total se ve restringida por la capacidad de la etapa más lenta',
              'El sistema incrementa su velocidad automáticamente',
              'Los demás componentes se vuelven completamente inmunes al cambio',
              'El cuello de botella no genera ningún impacto práctico'
            ])
          ]
        });

        if (checkpointCount >= 3) {
          const c3Id = `c-${sessionId}-3`;
          concepts.push({
            id: c3Id,
            order: 3,
            title: `${title}: Condiciones Límite y Modos de Fallo`,
            estimatedMinutes: 15,
            mentalModel: `Prueba de estrés de ${title}: comprensión de cómo la escala, la presión y las restricciones extremas alteran el comportamiento.`,
            coreTakeaways: [
              `Aplicar ${title} en el mundo real requiere reconocer cuándo los supuestos teóricos dejan de cumplirse.`,
              `Los límites de recursos determinan las fronteras de operatividad segura.`,
              `Identificar las condiciones límite previene fallos catastróficos en situaciones imprevistas.`
            ],
            keyTerms: [
              { term: 'Condición Límite', definition: `El valor de umbral donde el comportamiento estándar de ${title} cambia o falla.` },
              { term: 'Modo de Fallo', definition: 'La manera específica en que el sistema deja de satisfacer su función operativa.' }
            ],
            feynmanPrompt: `Describe un escenario donde alguien aplique ${title} fuera de sus límites y qué supuesto pasó por alto.`,
            sampleMasteryExplanation: `Los errores ocurren cuando se extienden reglas estándar más allá de sus supuestos iniciales; la maestría implica conocer esos límites.`,
            retrievalCards: [
              makeCard(c3Id, 1, 'standard', `¿Por qué es crucial identificar las condiciones límite al implementar ${title}?`, `Porque los sistemas exhiben comportamientos impredecibles cuando se superan sus supuestos operativos.`, 'Piensa en qué ocurre cuando los supuestos fallan.', 'El reconocimiento de límites distingue al aprendiz superficial del experto.'),
              makeCard(c3Id, 2, 'cloze', `Para evitar fallos en situaciones complejas con ${title}, es indispensable monitorizar {{las condiciones límite}}.`, 'las condiciones límite', 'Los umbrales donde las reglas cambian.', 'Comprender los límites previene errores críticos.'),
              makeCard(c3Id, 3, 'multiple-choice', `¿Cuál es el peligro de aplicar ${title} ignorando sus restricciones operativas?`, 'El sistema puede sufrir un fallo catastrófico al quebrarse los supuestos iniciales', 'Reflexiona sobre las pruebas de estrés en sistemas reales.', 'Conocer los límites operativos es el sello del dominio técnico.', [
                'El sistema puede sufrir un fallo catastrófico al quebrarse los supuestos iniciales',
                'Los cálculos teóricos siempre permanecen inmutables en cualquier escala',
                'Las restricciones operativas solo tienen valor académico, nunca práctico',
                'Todos los sistemas reaccionan idénticamente sin importar el estrés ambiental'
              ])
            ]
          });
        }

        if (checkpointCount >= 4) {
          const c4Id = `c-${sessionId}-4`;
          concepts.push({
            id: c4Id,
            order: 4,
            title: `${title}: Síntesis Avanzada e Integración Multisistema`,
            estimatedMinutes: 20,
            mentalModel: `Integración de ${title} en macroestructuras complejas, compensaciones estratégicas (trade-offs) y efectos de segundo orden.`,
            coreTakeaways: [
              `${title} forma parte de un ecosistema más amplio donde las decisiones generan efectos secundarios duraderos.`,
              `En problemas avanzados predominan las dinámicas contraintuitivas y los efectos de segundo orden.`,
              `Optimizar ${title} en la práctica implica balancear compensaciones entre eficiencia, robustez y costo.`
            ],
            keyTerms: [
              { term: 'Efecto de Segundo Orden', definition: 'La consecuencia indirecta originada por la reacción del sistema a un cambio inicial.' },
              { term: 'Integración Sistémica', definition: `La articulación armónica de ${title} con otros dominios y disciplinas adyacentes.` }
            ],
            feynmanPrompt: `Explica una consecuencia contraintuitiva en ${title} que un principiante ignoraría y detalla su mecanismo.`,
            sampleMasteryExplanation: `En niveles superiores, las intervenciones producen respuestas no lineales; la maestría radica en anticipar los efectos indirectos.`,
            retrievalCards: [
              makeCard(c4Id, 1, 'standard', `¿Por qué los efectos de segundo orden son determinantes al optimizar ${title}?`, `Porque los ajustes directos pueden generar consecuencias sistémicas no deseadas a mediano plazo.`, 'Anticipa las reacciones en cadena.', 'Pensar en segundo orden revela la arquitectura profunda del sistema.'),
              makeCard(c4Id, 2, 'cloze', `Al analizar intervenciones en ${title}, las repercusiones indirectas se denominan {{efectos de segundo orden}}.`, 'efectos de segundo orden', 'Respuestas indirectas del sistema.', 'La anticipación sistémica es la base del pensamiento experto.'),
              makeCard(c4Id, 3, 'multiple-choice', `¿Qué diferencia fundamentalmente a un especialista en ${title} de un principiante?`, 'La capacidad de anticipar efectos de segundo orden y gestionar compensaciones sistémicas', 'Considera la perspectiva holística.', 'La síntesis representa la cúspide del dominio cognitivo.', [
                'La capacidad de anticipar efectos de segundo orden y gestionar compensaciones sistémicas',
                'Repetir de memoria definiciones sin considerar el contexto amplio',
                'Afirmar que un sistema nunca requiere compensaciones ni equilibrios',
                'Reducir todo problema complejo a una solución única e invariable'
              ])
            ]
          });
        }
        break;
      }

      case 'de': {
        // --- GERMAN (DE) ---
        const c1Id = `c-${sessionId}-1`;
        concepts.push({
          id: c1Id,
          order: 1,
          title: `${title}: Grundlagen und Kernprinzipien`,
          estimatedMinutes: 12,
          mentalModel: `${title} ist ein vernetztes System, in dem primäre Komponenten nach definierten Kausalgesetzen stabile Ergebnisse erzeugen.`,
          coreTakeaways: [
            `Der fundamentale Zweck von ${title} besteht darin, Eingaben und Regeln zu koordinieren, um vorhersehbare Resultate zu erzielen.`,
            `Das Verstehen von Ursache-Wirkungs-Prinzipien ist nachhaltiger als das bloße Memorieren isolierter Fachbegriffe.`,
            `Die Kernkomponenten verhalten sich unter standardmäßigen Betriebsbedingungen stabil und deterministisch.`
          ],
          keyTerms: [
            { term: 'Funktionsmechanismus', definition: `Der primäre operative Motor, der die Dynamik von ${title} antreibt.` },
            { term: 'Kausale Invariante', definition: `Ein grundlegendes Prinzip von ${title}, das unter Standardbedingungen konstant gültig bleibt.` }
          ],
          feynmanPrompt: `Erkläre das Grundprinzip von ${title} einem 12-jährigen Kind, ohne verwirrende Fachbegriffe zu verwenden.`,
          sampleMasteryExplanation: `${title} nimmt grundlegende Ressourcen auf, wendet konsistente Regeln an und erzeugt ein optimiertes Ergebnis ohne unnötigen Reibungsverlust.`,
          retrievalCards: [
            makeCard(c1Id, 1, 'standard', `Was ist der grundlegende Zweck und die treibende Wirkungsweise von ${title}?`, `Die Koordination von Parametern und Grundgesetzen zur Erzeugung strukturierter, vorhersehbarer Ergebnisse.`, 'Fokussiere auf die Umwandlung von Input zu Output.', 'Aktiver Abruf festigt die neuronalen Grundlagenverbindungen.'),
            makeCard(c1Id, 2, 'cloze', `Für echtes Verständnis von ${title} ist das Begreifen {{des zugrunde liegenden Kausalmechanismus}} unerlässlich.`, 'des zugrunde liegenden Kausalmechanismus', 'Der funktionale Motor des Systems.', 'Kausales Denken verhindert die Illusion des Verstehens.'),
            makeCard(c1Id, 3, 'multiple-choice', `Welcher Ansatz ist am effektivsten zur Analyse von ${title}?`, 'Das Dekonstruieren von Ursache-Wirkungs-Zusammenhängen zwischen Schlüsselkomponenten', 'Denke in ersten Prinzipien.', 'Kausalketten schaffen belastbare mentale Modelle.', [
              'Das Dekonstruieren von Ursache-Wirkungs-Zusammenhängen zwischen Schlüsselkomponenten',
              'Isoliertes Auswendiglernen von Vokabeln ohne Kontext',
              'Die Annahme, dass das System völlig regellos operiert',
              'Ausschließliche Fokussierung auf oberflächliche Symptome'
            ])
          ]
        });

        const c2Id = `c-${sessionId}-2`;
        concepts.push({
          id: c2Id,
          order: 2,
          title: `${title}: Wirkungsmechanismen und Systeminteraktionen`,
          estimatedMinutes: 14,
          mentalModel: `Ein Getriebe, in dem jede Stufe von ${title} die nächste Phase antreibt und steuert.`,
          coreTakeaways: [
            `Jede Phase in ${title} fungiert als Auslöser für den darauffolgenden Prozessschritt.`,
            `Engpässe im Ressourcen- oder Informationsfluss determinieren die Leistungsfähigkeit des Gesamtsystems.`,
            `Rückkopplungsschleifen (Feedback Loops) stabilisieren das System gegen Störungen.`
          ],
          keyTerms: [
            { term: 'Prozessdynamik', definition: `Der kontinuierliche Interaktionsablauf zwischen den Elementen von ${title}.` },
            { term: 'Rückkopplungsschleife', definition: 'Rückführung von Systemausgaben zur automatischen Selbstregulation.' }
          ],
          feynmanPrompt: `Wie wirkt sich eine Störung in einem Teilschritt auf ${title} aus? Verwende eine alltagsnahe Kettenreaktions-Analogie.`,
          sampleMasteryExplanation: `Komponenten sind sequenziell verknüpft; ein einziger Engpass bremst durch Kaskadeneffekte das Gesamtergebnis.`,
          retrievalCards: [
            makeCard(c2Id, 1, 'standard', `Warum begrenzt ein Engpass in ${title} die Durchsatzrate des gesamten Systems?`, `Weil die Teilschritte sequenziell gekoppelt sind und die Gesamtrate vom langsamsten Glied bestimmt wird.`, 'Engpasstheorie anwenden.', 'Systemleistung bemisst sich am kritischen Pfad.'),
            makeCard(c2Id, 2, 'cloze', `Die Stabilität und Selbstregulation in ${title} wird durch {{Rückkopplungsschleifen}} gewährleistet.`, 'Rückkopplungsschleifen', 'Mechanismus zur adaptiven Selbststeuerung.', 'Regelkreise sind der Kern systemischen Denkens.'),
            makeCard(c2Id, 3, 'multiple-choice', `Was geschieht bei einer Blockade in einem Kernprozess von ${title}?`, 'Die Gesamtleistung wird durch die Kapazität des schwächsten Glieds limitiert', 'Betrachte die Kettenreaktion im Gesamtsystem.', 'Das Zusammenspiel bestimmt den Output.', [
              'Die Gesamtleistung wird durch die Kapazität des schwächsten Glieds limitiert',
              'Das System schaltet ohne Verzögerung auf maximale Effizienz',
              'Alle anderen Komponenten arbeiten völlig unbeeinflusst weiter',
              'Der Engpass hat in der Praxis keinerlei messbare Auswirkung'
            ])
          ]
        });

        if (checkpointCount >= 3) {
          const c3Id = `c-${sessionId}-3`;
          concepts.push({
            id: c3Id,
            order: 3,
            title: `${title}: Randbedingungen und Grenzszenarien`,
            estimatedMinutes: 15,
            mentalModel: `Stresstest für ${title}: Wie Skalierung und extreme Restriktionen das Systemverhalten verändern.`,
            coreTakeaways: [
              `In der praktischen Anwendung von ${title} muss erkannt werden, wann theoretische Annahmen ihre Gültigkeit verlieren.`,
              `Ressourcen- und Kapazitätsgrenzen definieren den sicheren Betriebsbereich.`,
              `Das Identifizieren von Randbedingungen schützt vor unerwartetem Systemversagen.`
            ],
            keyTerms: [
              { term: 'Randbedingung', definition: `Der kritische Schwellenwert, ab dem das Standardverhalten von ${title} bricht.` },
              { term: 'Fehlermodus', definition: 'Die spezifische Art und Weise, wie ein System bei Überlastung versagt.' }
            ],
            feynmanPrompt: `Beschreibe ein Szenario, in dem ${title} fehlschlägt, und erkläre, welche Betriebsannahme verletzt wurde.`,
            sampleMasteryExplanation: `Fehler entstehen, wenn Standardregeln über ihre Gültigkeitsgrenzen hinaus angewendet werden; Meisterschaft verlangt das Kennen dieser Schwellen.`,
            retrievalCards: [
              makeCard(c3Id, 1, 'standard', `Warum ist das Erfassen von Randbedingungen bei ${title} entscheidend?`, `Weil Systeme unvorhersehbar reagieren, sobald grundlegende Betriebsannahmen überschritten werden.`, 'Bedenke, was passiert, wenn Annahmen kippen.', 'Grenzen zu kennen unterscheidet Experten von Laien.'),
              makeCard(c3Id, 2, 'cloze', `Zur Vermeidung von Systemausfällen müssen bei ${title} {{die Randbedingungen}} kontinuierlich überwacht werden.`, 'die Randbedingungen', 'Kritische Schwellenwerte des Betriebs.', 'Grenzwerte trennen oberflächliches von tiefem Verständnis.'),
              makeCard(c3Id, 3, 'multiple-choice', `Was ist das größte Risiko bei der Anwendung von ${title} ohne Berücksichtigung von Randbedingungen?`, 'Katastrophales Versagen des Systems bei Überschreitung der Ausgangsannahmen', 'Reflektiere über reale Belastungstests.', 'Grenzwerte sind essenziell für verlässliche Modelle.', [
                'Katastrophales Versagen des Systems bei Überschreitung der Ausgangsannahmen',
                'Theoretische Berechnungen bleiben unter jedem Druck absolut fehlerfrei',
                'Einschränkungen spielen nur in Lehrbüchern, nicht in der Realität eine Rolle',
                'Alle Systeme reagieren völlig unempfindlich gegenüber extremen Umweltfaktoren'
              ])
            ]
          });
        }

        if (checkpointCount >= 4) {
          const c4Id = `c-${sessionId}-4`;
          concepts.push({
            id: c4Id,
            order: 4,
            title: `${title}: Fortgeschrittene Synthese und Systemintegration`,
            estimatedMinutes: 20,
            mentalModel: `Makrointegration von ${title}, strategische Zielkonflikte (Trade-offs) und Effekte zweiter Ordnung.`,
            coreTakeaways: [
              `${title} ist Teil eines übergeordneten Netzwerks, in dem Eingriffe indirekte Fernwirkungen entfalten.`,
              `In komplexen Problemstellungen dominieren kontraintuitive Dynamiken und Effekte zweiter Ordnung.`,
              `Praktische Optimierung erfordert das Ausbalancieren von Zielkonflikten zwischen Effizienz und Robustheit.`
            ],
            keyTerms: [
              { term: 'Effekt zweiter Ordnung', definition: 'Die indirekte Folge, die durch die adaptive Reaktion des Systems auf eine Primärwirkung entsteht.' },
              { term: 'Systemische Synthese', definition: `Das nahtlose Zusammenwirken von ${title} mit übergeordneten Strukturen.` }
            ],
            feynmanPrompt: `Erkläre einen kontraintuitiven Effekt in ${title}, den ein Anfänger übersehen würde, und lege den Mechanismus dar.`,
            sampleMasteryExplanation: `Auf fortgeschrittenem Niveau erzeugen Maßnahmen nicht-lineare Systemreaktionen; wahre Expertise kalkuliert diese indirekten Effekte voraus.`,
            retrievalCards: [
              makeCard(c4Id, 1, 'standard', `Warum müssen bei der Optimierung von ${title} Effekte zweiter Ordnung einkalkuliert werden?`, `Weil isolierte Primärmaßnahmen durch indirekte Rückkopplungen das Gesamtsystem destabilisieren können.`, 'Betrachte die verborgene Kettenreaktion.', 'Denken in zweiter Ordnung offenbart die Tiefenstruktur.'),
              makeCard(c4Id, 2, 'cloze', `Die indirekten, zeitverzögerten Auswirkungen einer Maßnahme in ${title} heißen {{Effekte zweiter Ordnung}}.`, 'Effekte zweiter Ordnung', 'Indirekte systemische Konsequenzen.', 'Systemische Vorausschau zeichnet Experten aus.'),
              makeCard(c4Id, 3, 'multiple-choice', `Welche Fähigkeit unterscheidet einen Experten für ${title} wesentlich von einem Einsteiger?`, 'Das Antizipieren von Effekten zweiter Ordnung und das Abwägen systemischer Zielkonflikte', 'Ganzheitliche Synthese betrachten.', 'Synthese ist die höchste Stufe kognitiver Meisterschaft.', [
                'Das Antizipieren von Effekten zweiter Ordnung und das Abwägen systemischer Zielkonflikte',
                'Das schematische Rezitieren vorgegebener Formeln ohne Gesamtblick',
                'Die Behauptung, dass Systeme niemals Zielkonflikte oder Kompromisse erfordern',
                'Die Reduktion aller komplexen Sachverhalte auf isolierte Einzelursachen'
              ])
            ]
          });
        }
        break;
      }

      default: {
        // --- ENGLISH (EN) & DEFAULT FALLBACK ---
        const c1Id = `c-${sessionId}-1`;
        concepts.push({
          id: c1Id,
          order: 1,
          title: `Foundations & Core Principles of ${title}`,
          estimatedMinutes: 12,
          mentalModel: `An interconnected framework where the primary components of ${title} interact according to governing causal laws.`,
          coreTakeaways: [
            `The primary purpose of ${title} is to coordinate inputs and rules to produce structured, predictable outcomes.`,
            `Understanding the cause-and-effect dynamics of ${title} is 10x more effective than memorizing isolated surface terms.`,
            `The core properties of ${title} remain stable across standard operating conditions.`
          ],
          keyTerms: [
            { term: 'Operational Mechanism', definition: `The primary functional engine that drives how ${title} works.` },
            { term: 'Causal Invariant', definition: `The foundational rule of ${title} that holds true under normal circumstances.` }
          ],
          feynmanPrompt: `Explain the foundational concept of ${title} in plain language as if explaining it to a curious 12-year-old. Avoid obscure jargon.`,
          sampleMasteryExplanation: `At its core, ${title} works by taking foundational resources or inputs, applying predictable rules, and producing an optimized outcome without unnecessary friction.`,
          retrievalCards: [
            makeCard(c1Id, 1, 'standard', `What is the fundamental purpose and driving mechanism behind ${title}?`, `At its core, ${title} coordinates inputs and governing principles to transform resources and produce predictable, structured results.`, 'Focus on how inputs become outputs.', 'Retrieval practice strengthens the neural pathways associated with foundational principles.'),
            makeCard(c1Id, 2, 'cloze', `In analyzing ${title}, true comprehension requires understanding {{the underlying causal mechanism}}, rather than memorizing surface facts.`, 'the underlying causal mechanism', 'The functional engine that drives how things happen.', 'Focusing on cause and effect protects against the illusion of competence.'),
            makeCard(c1Id, 3, 'multiple-choice', `Which approach is most effective when analyzing the fundamental behavior of ${title}?`, 'Deconstructing the cause-and-effect relationships among its key components', 'Think about first-principles reasoning.', 'Tracing causal chains from inputs to outputs creates durable mental models.', [
              'Deconstructing the cause-and-effect relationships among its key components',
              'Memorizing isolated vocabulary terms without understanding their interactions',
              'Assuming the system operates without any governing constraints or rules',
              'Focusing exclusively on surface appearances while ignoring the underlying process'
            ])
          ]
        });

        const c2Id = `c-${sessionId}-2`;
        concepts.push({
          id: c2Id,
          order: 2,
          title: `Operational Dynamics & System Interactions of ${title}`,
          estimatedMinutes: 14,
          mentalModel: `A cascade of interlinked gears where each operational phase of ${title} triggers and conditions the next.`,
          coreTakeaways: [
            `Every intermediate stage in ${title} serves as the catalyst for subsequent events in the system.`,
            `Resource and information bottlenecks dictate the throughput capacity of the entire framework.`,
            `Feedback loops provide corrective stability against external perturbations.`
          ],
          keyTerms: [
            { term: 'Process Dynamics', definition: `The sequential flow of cause-and-effect transitions within ${title}.` },
            { term: 'Feedback Regulation', definition: 'The mechanism by which system outputs adjust internal parameters to maintain equilibrium.' }
          ],
          feynmanPrompt: `Describe what happens when one component in ${title} falters, using a clear domino or chain-reaction analogy.`,
          sampleMasteryExplanation: `Components operate in a linked chain; a single constriction point slows the entire rate of progress through cascade effects.`,
          retrievalCards: [
            makeCard(c2Id, 1, 'standard', `Why does a bottleneck in ${title} limit the performance of the entire system?`, `Because components function in an interdependent sequence where overall throughput cannot exceed the slowest link.`, 'Recall the theory of constraints.', 'Systemic capacity is governed by critical-path limits.'),
            makeCard(c2Id, 2, 'cloze', `In ${title}, stability against external disturbances is maintained through {{feedback regulation loops}}.`, 'feedback regulation loops', 'The self-correcting regulatory mechanism.', 'Regulation is central to systems thinking.'),
            makeCard(c2Id, 3, 'multiple-choice', `What occurs when a primary bottleneck is introduced into ${title}?`, 'The total throughput rate is throttled to match the capacity of the bottleneck', 'Think about sequential dependency.', 'System throughput cannot outpace its narrowest channel.', [
              'The total throughput rate is throttled to match the capacity of the bottleneck',
              'The system automatically achieves frictionless infinite throughput',
              'All other components operate completely insulated from downstream effects',
              'Bottlenecks have zero measurable effect on real-world systems'
            ])
          ]
        });

        if (checkpointCount >= 3) {
          const c3Id = `c-${sessionId}-3`;
          concepts.push({
            id: c3Id,
            order: 3,
            title: `Boundary Conditions & Failure Modes of ${title}`,
            estimatedMinutes: 15,
            mentalModel: `Testing the limits of ${title}: understanding how scale, stress, and shifting constraints impact performance.`,
            coreTakeaways: [
              `Real-world application of ${title} requires recognizing when standard theoretical assumptions break down.`,
              `External constraints and resource limits determine the operational boundaries of ${title}.`,
              `Optimizing ${title} in practice involves identifying and resolving systemic bottlenecks.`
            ],
            keyTerms: [
              { term: 'Boundary Condition', definition: `The specific operational limit where the normal behavior of ${title} shifts.` },
              { term: 'Failure Mode', definition: 'The predictable breakdown pattern that emerges when constraints are breached.' }
            ],
            feynmanPrompt: `Describe a real-world scenario where someone misapplies ${title}, and explain what constraint they overlooked.`,
            sampleMasteryExplanation: `Failures typically occur when applying standard rules past their boundary conditions; success requires adapting the model to account for real friction.`,
            retrievalCards: [
              makeCard(c3Id, 1, 'standard', `Why is identifying boundary conditions critical when applying ${title} in the real world?`, `Because systems behave unpredictably when their operational limits or foundational assumptions are exceeded.`, 'Consider what happens when assumptions fail.', 'Understanding edge cases prevents catastrophic failure during real-world application.'),
              makeCard(c3Id, 2, 'cloze', `Applying ${title} to complex scenarios requires monitoring {{boundary constraints}} to prevent failure when conditions deviate from normal assumptions.`, 'boundary constraints', 'The operational limits where rules begin to shift.', 'Recognizing boundary conditions separates surface learners from true experts.'),
              makeCard(c3Id, 3, 'multiple-choice', `What is the primary danger when applying ${title} without considering its operational constraints?`, 'The system can experience catastrophic failure when operating assumptions no longer hold', 'Think about real-world stress testing.', 'Recognizing when models fail is the hallmark of deep mastery.', [
                'The system can experience catastrophic failure when operating assumptions no longer hold',
                'It makes theoretical calculations impossible to formulate in any setting',
                'Operating constraints only matter in academic textbooks, never in practice',
                'All systems function identically regardless of scale or environmental stress'
              ])
            ]
          });
        }

        if (checkpointCount >= 4) {
          const c4Id = `c-${sessionId}-4`;
          concepts.push({
            id: c4Id,
            order: 4,
            title: `Advanced Synthesis & Multi-System Integration of ${title}`,
            estimatedMinutes: 20,
            mentalModel: `Macro-level integration of ${title}, strategic trade-offs, and counter-intuitive second-order consequences.`,
            coreTakeaways: [
              `${title} does not exist in isolation; it functions as a sub-engine within larger hierarchical architectures.`,
              `Advanced challenges require accounting for second-order consequences that manifest downstream.`,
              `True mastery balances trade-offs between speed, stability, and resource expenditure.`
            ],
            keyTerms: [
              { term: 'Second-Order Effect', definition: 'The indirect consequence triggered by the system response to an initial intervention.' },
              { term: 'Systemic Integration', definition: `The harmonious alignment of ${title} within adjacent domains and higher-order frameworks.` }
            ],
            feynmanPrompt: `Explain a counter-intuitive paradox in ${title} that a novice would misinterpret, and explain the underlying mechanism.`,
            sampleMasteryExplanation: `At advanced levels, direct inputs generate delayed, non-linear reverberations; expertise lies in anticipating these second-order dynamics.`,
            retrievalCards: [
              makeCard(c4Id, 1, 'standard', `Why must second-order effects be anticipated when performing advanced optimizations on ${title}?`, `Because direct interventions often induce delayed counter-responses that can destabilize the larger system.`, 'Trace the indirect feedback loops.', 'Thinking in second-order effects reveals deep systemic architecture.'),
              makeCard(c4Id, 2, 'cloze', `In advanced analysis of ${title}, the downstream systemic reactions to an initial action are called {{second-order effects}}.`, 'second-order effects', 'Indirect, delayed consequences.', 'Anticipating indirect feedback is the hallmark of expert judgment.'),
              makeCard(c4Id, 3, 'multiple-choice', `What fundamentally differentiates a high-level specialist in ${title} from an intermediate student?`, 'The ability to anticipate second-order consequences and manage systemic trade-offs', 'Consider holistic synthesis.', 'Synthesis is the pinnacle of cognitive mastery.', [
                'The ability to anticipate second-order consequences and manage systemic trade-offs',
                'Rote recital of formulas without understanding their contextual applicability',
                'Claiming that perfect solutions exist without any trade-offs or constraints',
                'Reducing every multi-variable problem to a single isolated cause'
              ])
            ]
          });
        }
        break;
      }
    }

    // Capitalize title
    const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);

    const categoryMap: Record<string, string> = {
      tr: 'Bilişsel Çalışma Planı',
      es: 'Plan de Estudio Cognitivo',
      de: 'Kognitiver Studienplan',
      fr: 'Plan d\'Étude Cognitif',
      it: 'Piano di Studio Cognitivo',
      pt: 'Plano de Estudo Cognitivo',
      zh: '认知学习方案',
      ja: '認知学習プラン',
      ar: 'خطة الدراسة المعرفية',
      en: 'Synthesized Topic',
    };

    const descMap: Record<string, string> = {
      tr: `"${formattedTitle}" konusu için ${checkpointCount} aşamalı, nedensel mekanizmalara ve sınır koşullarına odaklı bilimsel öğrenme oturumu.`,
      es: `Sesión de estudio estructurada sobre "${formattedTitle}" con ${checkpointCount} etapas enfocadas en mecanismos causales y condiciones límite.`,
      de: `Strukturierte Lerneinheit zu "${formattedTitle}" mit ${checkpointCount} Phasen, fokussiert auf Wirkungsmechanismen und Randbedingungen.`,
      fr: `Session d'étude structurée sur "${formattedTitle}" avec ${checkpointCount} étapes axées sur les mécanismes causaux et conditions limites.`,
      it: `Sessione di studio strutturata su "${formattedTitle}" con ${checkpointCount} fasi incentrate su meccanismi causali e condizioni limite.`,
      pt: `Sessão de estudo estruturada sobre "${formattedTitle}" com ${checkpointCount} etapas focadas em mecanismos causais e condições limite.`,
      zh: `针对"${formattedTitle}"的${checkpointCount}阶段科学学习会话，深度聚焦因果机制与边界条件。`,
      ja: `"${formattedTitle}"の${checkpointCount}段階の科学的学習セッション。因果機構と境界条件に特化。`,
      ar: `جلسة دراسية علمية مكونة من ${checkpointCount} مراحل حول "${formattedTitle}" تركز على الآليات السببية والشروط الحدية.`,
      en: `Structured cognitive breakdown of "${formattedTitle}" with ${checkpointCount} checkpoints focused on foundational mechanisms, dynamics, and boundary conditions.`,
    };

    return {
      id: sessionId,
      title: formattedTitle,
      category: categoryMap[langCode] || categoryMap.en,
      description: descMap[langCode] || descMap.en,
      currentConceptIndex: 0,
      currentPhase: 'priming',
      elapsedSeconds: 0,
      createdAt: new Date().toISOString(),
      depthTier,
      gradeLevel,
      languageCode: langCode,
      concepts,
    };
  }
}

