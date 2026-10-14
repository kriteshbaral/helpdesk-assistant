/*
 * Offline "AI" for the helpdesk assistant. No API, no internet.
 *
 *  1. tokenize()        - turns text into normalised words and word pairs
 *  2. SearchIndex       - BM25 ranking, the same scoring method search engines use,
 *                         to find the best knowledge-base article
 *  3. NaiveBayes        - a small machine-learning classifier that predicts a
 *                         ticket's category from labelled examples
 *  4. assessPriority()  - ITIL impact x urgency matrix to set P1-P4
 *  5. evaluate()        - k-fold cross-validation to measure the classifier honestly
 */
(function (root) {
  // ---------- 1. Text processing ----------
  const STOPWORDS = new Set(
    ("a an the and or but if of to in on at for from by with is are was were be been it its this that " +
     "i me my we our you your he she they them his her their please hi hello thanks thank can could " +
     "would should will just also very really so as into about up out again now there here when what " +
     "which who how all some any do does did has have had am get got still")
      .split(" ")
  );

  // A light "stemmer": maps word forms to one root so "crashes", "crashing", "crashed" match.
  function stem(w) {
    if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  const SYNONYMS = {
    "wi-fi": "wifi", wireless: "wifi", "e-mail": "email", emails: "email", mail: "email",
    login: "log", signin: "sign", pwd: "password", pw: "password", "2fa": "mfa",
    authenticator: "mfa", laptop: "laptop", pc: "computer", copier: "printer",
    licence: "license", colour: "color",
  };

  function tokenize(text, { bigrams = false } = {}) {
    const words = String(text)
      .toLowerCase()
      .replace(/[’']/g, "")            // can't -> cant
      .replace(/wi-fi/g, "wifi")
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((w) => SYNONYMS[w] || w)
      .filter((w) => !STOPWORDS.has(w) && w.length > 1)
      .map(stem);
    if (!bigrams) return words;
    const pairs = [];
    for (let i = 0; i < words.length - 1; i++) pairs.push(words[i] + "_" + words[i + 1]);
    return words.concat(pairs);
  }

  // ---------- 2. BM25 search over the knowledge base ----------
  class SearchIndex {
    constructor(docs, fields, { k1 = 1.4, b = 0.75 } = {}) {
      this.docs = docs;
      this.k1 = k1;
      this.b = b;
      this.tokens = docs.map((d) => tokenize(fields(d)));
      this.avgLen = this.tokens.reduce((s, t) => s + t.length, 0) / docs.length;
      this.df = new Map(); // how many documents contain each word
      for (const toks of this.tokens) {
        for (const w of new Set(toks)) this.df.set(w, (this.df.get(w) || 0) + 1);
      }
    }
    idf(w) {
      const n = this.docs.length, df = this.df.get(w) || 0;
      return Math.log(1 + (n - df + 0.5) / (df + 0.5));
    }
    search(query, limit = 3) {
      const q = [...new Set(tokenize(query))];
      const scored = this.tokens.map((toks, i) => {
        let score = 0;
        for (const w of q) {
          const tf = toks.filter((t) => t === w).length;
          if (!tf) continue;
          const norm = tf * (this.k1 + 1) / (tf + this.k1 * (1 - this.b + this.b * toks.length / this.avgLen));
          score += this.idf(w) * norm;
        }
        return { doc: this.docs[i], score };
      });
      return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    }
  }

  // ---------- 3. Multinomial Naive Bayes classifier ----------
  class NaiveBayes {
    constructor({ alpha = 1, bigrams = false } = {}) { this.alpha = alpha; this.bigrams = bigrams; } // alpha = Laplace smoothing

    train(examples) {
      this.classes = [...new Set(examples.map((e) => e.category))];
      this.vocab = new Set();
      this.docCount = {}; this.wordCount = {}; this.totalWords = {};
      for (const c of this.classes) { this.docCount[c] = 0; this.wordCount[c] = new Map(); this.totalWords[c] = 0; }
      for (const { text, category } of examples) {
        this.docCount[category]++;
        for (const w of tokenize(text, { bigrams: this.bigrams })) {
          this.vocab.add(w);
          this.wordCount[category].set(w, (this.wordCount[category].get(w) || 0) + 1);
          this.totalWords[category]++;
        }
      }
      this.n = examples.length;
      return this;
    }

    // log P(word | class), smoothed so unseen words don't zero everything out
    logLikelihood(w, c) {
      const count = this.wordCount[c].get(w) || 0;
      return Math.log((count + this.alpha) / (this.totalWords[c] + this.alpha * this.vocab.size));
    }

    predict(text) {
      const words = tokenize(text, { bigrams: this.bigrams }).filter((w) => this.vocab.has(w));
      const logScores = this.classes.map((c) => {
        let s = Math.log(this.docCount[c] / this.n); // prior
        for (const w of words) s += this.logLikelihood(w, c);
        return s;
      });
      // softmax turns log scores into probabilities that add up to 1
      const max = Math.max(...logScores);
      const exp = logScores.map((s) => Math.exp(s - max));
      const sum = exp.reduce((a, b) => a + b, 0);
      const ranked = this.classes
        .map((c, i) => ({ category: c, probability: exp[i] / sum }))
        .sort((a, b) => b.probability - a.probability);
      return { category: ranked[0].category, confidence: ranked[0].probability, ranked, knownWords: words.length };
    }

    // Which words pushed the prediction towards this category? (explainability)
    explain(text, category, top = 3) {
      const words = [...new Set(tokenize(text).filter((w) => this.vocab.has(w)))];
      return words
        .map((w) => {
          const own = this.logLikelihood(w, category);
          const avg = this.classes.reduce((s, c) => s + this.logLikelihood(w, c), 0) / this.classes.length;
          return { word: w, weight: own - avg };
        })
        .filter((x) => x.weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, top);
    }
  }

  // ---------- 4. ITIL priority: impact x urgency ----------
  const IMPACT_HIGH = /\b(everyone|everybody|whole (office|site|team|floor|building|company)|all (staff|users|of us)|entire|nobody|no one|site (is )?(down|offline)|server (is )?down|multiple sites|all sites)\b/;
  const IMPACT_MED = /\b(team|several|few of us|department|some (users|people|staff)|others too|colleagues|we all|ward)\b/;
  const URGENCY_HIGH = /\b(can'?t work|cannot work|unable to work|urgent(ly)?|asap|immediately|right now|deadline|down|ransomware|encrypted|hacked|stolen|lost my (laptop|phone)|clicked|entered my password|completely|won'?t (turn on|start|boot)|no internet)\b/;
  const URGENCY_MED = /\b(slow|intermittent|keeps|sometimes|drop(s|ping)?|crash(es|ing)?|freez(es|ing)|error|not working|stuck|won'?t|can'?t|cannot|fail(s|ed|ing)?)\b/;

  const MATRIX = { // [impact][urgency] -> priority
    High:   { High: "P1 - Critical", Medium: "P2 - High",   Low: "P3 - Medium" },
    Medium: { High: "P2 - High",     Medium: "P3 - Medium", Low: "P4 - Low" },
    Low:    { High: "P3 - Medium",   Medium: "P4 - Low",    Low: "P4 - Low" },
  };
  const ORDER = ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"];

  // Same targets as the service desk analytics project
  const SLA = {
    "P1 - Critical": { responseMin: 15, resolveHours: 4 },
    "P2 - High": { responseMin: 30, resolveHours: 8 },
    "P3 - Medium": { responseMin: 240, resolveHours: 24 },
    "P4 - Low": { responseMin: 480, resolveHours: 72 },
  };

  function assessPriority(text, category) {
    const t = String(text).toLowerCase();
    const impact = IMPACT_HIGH.test(t) ? "High" : IMPACT_MED.test(t) ? "Medium" : "Low";
    const urgency = URGENCY_HIGH.test(t) ? "High" : URGENCY_MED.test(t) ? "Medium" : "Low";
    let priority = MATRIX[impact][urgency];
    const reasons = [`Impact: ${impact}`, `Urgency: ${urgency}`];
    // Security incidents are never treated as low priority
    if (category === "Security" && ORDER.indexOf(priority) > 1) {
      priority = urgency === "High" ? "P2 - High" : "P3 - Medium";
      if (urgency === "High") reasons.push("Raised: security incident");
    }
    return { priority, impact, urgency, reasons, sla: SLA[priority] };
  }

  // ---------- 4b. Security safety net ----------
  // A missed security incident costs far more than a false alarm, so clear
  // security words override the classifier. Rules + ML is a common pattern.
  const SECURITY_SIGNALS = /\b(phish\w*|scam\w*|hack(ed|er)?|ransomware|malware|virus|infected|suspicious|fake|stolen|stole|pretend\w*|spoof\w*|clicked (a |the )?(link|attachment)|gift cards?|redirect\w*|overseas|didn'?t request|by mistake|shared my password|wrong person)\b/i;

  function classify(model, text) {
    const result = model.predict(text);
    if (result.category !== "Security" && SECURITY_SIGNALS.test(text)) {
      const match = String(text).match(SECURITY_SIGNALS)[0];
      return { ...result, category: "Security", overriddenFrom: result.category, overrideReason: `Security word detected: "${match}"` };
    }
    return result;
  }

  // ---------- 5. Honest evaluation ----------
  // k-fold cross-validation: split the examples into k groups, train on k-1
  // groups and test on the one left out, then repeat so every example is
  // tested exactly once on a model that never saw it.
  const MODEL_OPTIONS = { alpha: 0.5, bigrams: false };

  function kbExamples(kb) {
    return (kb || []).map((d) => ({ text: d.title + " " + d.keywords, category: d.category }));
  }

  function trainModel(examples, kb) {
    return new NaiveBayes(MODEL_OPTIONS).train(examples.concat(kbExamples(kb)));
  }

  function evaluate(examples, kb, k = 4, { safetyNet = true } = {}) {
    const perClass = {};
    const confusion = {};
    let correct = 0;
    const mistakes = [];
    for (let fold = 0; fold < k; fold++) {
      const seen = {}, train = [], test = [];
      for (const e of examples) {
        seen[e.category] = (seen[e.category] || 0) + 1;
        (seen[e.category] % k === fold ? test : train).push(e);
      }
      const model = trainModel(train, kb);
      for (const c of model.classes) {
        perClass[c] = perClass[c] || { tp: 0, fp: 0, fn: 0 };
        confusion[c] = confusion[c] || {};
      }
      for (const e of test) {
        const p = safetyNet ? classify(model, e.text).category : model.predict(e.text).category;
        confusion[e.category][p] = (confusion[e.category][p] || 0) + 1;
        if (p === e.category) { correct++; perClass[e.category].tp++; }
        else { perClass[e.category].fn++; perClass[p].fp++; mistakes.push({ text: e.text, expected: e.category, predicted: p }); }
      }
    }
    const rows = Object.keys(perClass).map((c) => {
      const { tp, fp, fn } = perClass[c];
      return { category: c, precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0, testCount: tp + fn };
    });
    return { accuracy: correct / examples.length, correct, total: examples.length, folds: k, rows, confusion, mistakes };
  }

  const api = { tokenize, SearchIndex, NaiveBayes, assessPriority, classify, evaluate, trainModel, SLA, MODEL_OPTIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NLP = api;
})(typeof window !== "undefined" ? window : globalThis);
