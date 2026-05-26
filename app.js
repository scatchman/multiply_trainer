'use strict';

// =============================================================
// 1. МОДЕЛЬ ПРИМЕРА
// =============================================================

class Example {
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.result = a * b;
  }
  toString()        { return `${this.a}×${this.b}=${this.result}`; }
  isReverseOf(other){ return this.a === other.b && this.b === other.a; }
  equals(other)     { return this.a === other.a && this.b === other.b; }
}

// =============================================================
// 2. ПУЛ ПРИМЕРОВ
// =============================================================

class ExamplePool {
  constructor(options = {}) {
    this.minFactor = options.minFactor ?? 2;
    this.maxFactor = options.maxFactor ?? 9;
    this._filters  = [];
    this._allExamples = this._buildAllExamples();
  }

  _buildAllExamples() {
    const list = [];
    for (let a = this.minFactor; a <= this.maxFactor; a++)
      for (let b = this.minFactor; b <= this.maxFactor; b++)
        list.push(new Example(a, b));
    return list;
  }

  addFilter(filterFn, id = null) { this._filters.push({ id, fn: filterFn }); }
  removeFilter(id) { this._filters = this._filters.filter(f => f.id !== id); }

  getAvailableExamples() {
    return this._allExamples.filter(ex =>
      this._filters.every(f => f.fn(ex))
    );
  }
}

// =============================================================
// 3. ВАЛИДАТОРЫ
// =============================================================

class NoSameFirstDigitValidator {
  validate(c, ctx) { return !ctx.previous || c.a !== ctx.previous.a; }
}
class NoSameSecondDigitValidator {
  validate(c, ctx) { return !ctx.previous || c.b !== ctx.previous.b; }
}
class NoReverseExampleValidator {
  validate(c, ctx) { return !ctx.previous || !c.isReverseOf(ctx.previous); }
}
class NoSameResultValidator {
  validate(c, ctx) { return !ctx.previous || c.result !== ctx.previous.result; }
}
class NoRecentRepeatValidator {
  constructor(lookback = 8) { this.lookback = lookback; }
  validate(c, ctx) {
    return !ctx.history.slice(-this.lookback).some(ex => ex.equals(c));
  }
}

class ValidatorManager {
  constructor() { this._validators = []; }
  add(v, id = null) { this._validators.push({ id, validator: v }); return this; }
  remove(id) { this._validators = this._validators.filter(v => v.id !== id); return this; }
  isValid(candidate, ctx) {
    return this._validators.every(({ validator }) => validator.validate(candidate, ctx));
  }
}

// =============================================================
// 4. РЕЖИМ УМНЫЙ РАНДОМ
// =============================================================

class SmartRandomMode {
  constructor(validatorManager, maxAttempts = 100) {
    this.validatorManager = validatorManager;
    this.maxAttempts = maxAttempts;
  }

  next(pool, context) {
    const available = pool.getAvailableExamples();
    if (available.length === 0) return null;

    for (let i = 0; i < this.maxAttempts; i++) {
      const candidate = available[Math.floor(Math.random() * available.length)];
      if (this.validatorManager.isValid(candidate, context)) return candidate;
    }

    console.warn('SmartRandomMode: fallback');
    return available[Math.floor(Math.random() * available.length)];
  }
}

// =============================================================
// 5. РЕЖИМ МАРАФОН 100
// =============================================================

class Marathon100Mode {
  constructor() { this.reset(); }

  reset() {
    this._pending  = [];
    this._solved   = [];
    this._current  = null;
    this._finished = false;
    this._accumulatedSeconds = 0;
    this._sessionStart = null;

    for (let a = 1; a <= 10; a++)
      for (let b = 1; b <= 10; b++)
        this._pending.push(new Example(a, b));
  }

  start() {
    if (this._finished) return;
    if (!this._sessionStart) this._sessionStart = Date.now();
  }

  pause() {
    if (this._sessionStart && !this._finished) {
      this._accumulatedSeconds += Math.floor((Date.now() - this._sessionStart) / 1000);
      this._sessionStart = null;
    }
  }

  next() {
    if (this._pending.length === 0) return null;

    let candidates = this._pending;
    if (this._current && candidates.length > 1)
      candidates = candidates.filter(ex => !ex.equals(this._current));

    this._current = candidates[Math.floor(Math.random() * candidates.length)];
    return this._current;
  }

  markSolved(example) {
    this._pending = this._pending.filter(ex => !ex.equals(example));
    this._solved.push(example);
    if (this._pending.length === 0) {
      this.pause();
      this._finished = true;
    }
  }

  markFailed() { /* пример остаётся в пуле */ }

  get solvedCount()      { return this._solved.length; }
  get pendingCount()     { return this._pending.length; }
  get isFinished()       { return this._finished; }
  get progressPercent()  { return Math.round(this._solved.length / 100 * 100); }
  get solvedList()       { return this._solved.slice(); }

  get elapsedSeconds() {
    let total = this._accumulatedSeconds;
    if (this._sessionStart && !this._finished) {
      total += Math.floor((Date.now() - this._sessionStart) / 1000);
    }
    return total;
  }

  get elapsedFormatted() {
    const m = Math.floor(this.elapsedSeconds / 60);
    const s = this.elapsedSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  toJSON() {
    return {
      solved: this._solved.map(ex => [ex.a, ex.b]),
      accumulatedSeconds: this.elapsedSeconds,
      finished: this._finished,
    };
  }

  static fromJSON(data) {
    const m = new Marathon100Mode();
    if (!data) return m;

    m._solved = (data.solved || []).map(([a, b]) => new Example(a, b));
    m._pending = m._pending.filter(ex =>
      !m._solved.some(s => s.equals(ex))
    );
    m._accumulatedSeconds = data.accumulatedSeconds || 0;
    m._finished = !!data.finished;
    m._sessionStart = null;
    return m;
  }
}

// =============================================================
// 6. СТАТИСТИКА
// =============================================================

class Statistics {
  constructor() { this.reset(); }

  reset() { this.total = 0; this.correct = 0; this.wrong = 0; }

  recordCorrect() { this.total++; this.correct++; }
  recordWrong()   { this.total++; this.wrong++;   }

  get accuracy() {
    return this.total === 0
      ? null
      : Math.round((this.correct / this.total) * 100);
  }

  toJSON() {
    return { total: this.total, correct: this.correct, wrong: this.wrong };
  }

  static fromJSON(data) {
    const s = new Statistics();
    if (data) {
      s.total = data.total || 0;
      s.correct = data.correct || 0;
      s.wrong = data.wrong || 0;
    }
    return s;
  }
}

// =============================================================
// 7. АЧИВКИ
// =============================================================

class DailyAchievements {
  constructor() {
    this.EMOJI_GOOD = [
      '🌸','🦋','🌈','🐬','🌺','🦄','🍀','⭐','🌙','🎠',
      '🐳','🌻','🦊','🎪','🍭','🌊','🦚','🎡','🌴','🍓',
      '🦜','🎨','🌷','🐝','🎭','🌟','🦋','🍉','🎪','🌮',
    ];
    this.EMOJI_PERFECT = [
      '👑','🏆','💎','🚀','🌠','✨','🎯','💫','🔮','🎖',
      '🌋','⚡','🎆','🏅','💥','🌟','🎇','🦁','🔱','💡',
      '🎊','🎉','🥇','🌞','🎸','🦅','🎺','💪','🌍','🎓',
    ];
  }

  _getDayOfYear() {
    const now  = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  }

  getGoodEmoji()    { return this.EMOJI_GOOD   [this._getDayOfYear() % this.EMOJI_GOOD.length];    }
  getPerfectEmoji() { return this.EMOJI_PERFECT[this._getDayOfYear() % this.EMOJI_PERFECT.length]; }

  checkAchievement(stats) {
    if (stats.correct < 100) return null;
    if (stats.wrong === 0)   return 'perfect';
    if (stats.wrong / (stats.correct + stats.wrong) < 0.10) return 'good';
    return null;
  }

  getRewardData(level) {
    if (level === 'perfect') return {
      tier: 'gold', emoji: this.getPerfectEmoji(),
      title: 'ИДЕАЛЬНО! Без единой ошибки!',
      message: 'Ты решила 100 примеров и не ошиблась ни разу!\nЭто невероятно! 🏆',
    };
    if (level === 'good') return {
      tier: 'silver', emoji: this.getGoodEmoji(),
      title: 'Отличная тренировка!',
      message: 'Ты решила 100 примеров почти без ошибок!\nТак держать! 💪',
    };
    return null;
  }
}

// =============================================================
// 8. ИГРОВОЙ ДЕНЬ (сменяется в 3:00 ночи)
// =============================================================

class GameDay {
  static current() {
    const now = new Date();
    const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, '0');
    const d = String(shifted.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

// =============================================================
// 9. ХРАНИЛИЩЕ ПРОФИЛЕЙ
// =============================================================

class ProfileStorage {
  static STORAGE_VERSION = 1;
  static KEY_PREFIX = 'mathTrainer.profile.';

  static load(profileId) {
    try {
      const raw = localStorage.getItem(this.KEY_PREFIX + profileId);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== this.STORAGE_VERSION) {
        console.warn(`Profile ${profileId}: version mismatch, ignoring`);
        return null;
      }
      return data;
    } catch (e) {
      console.error('ProfileStorage.load error:', e);
      return null;
    }
  }

  static save(profileId, data) {
    try {
      const payload = { version: this.STORAGE_VERSION, ...data };
      localStorage.setItem(this.KEY_PREFIX + profileId, JSON.stringify(payload));
    } catch (e) {
      console.error('ProfileStorage.save error:', e);
    }
  }

  static clear(profileId) {
    localStorage.removeItem(this.KEY_PREFIX + profileId);
  }
}

// =============================================================
// 10. МЕНЕДЖЕР ПРОФИЛЯ
// =============================================================

class ProfileManager {
  constructor(profileId) {
    this.profileId = profileId; // 'daughter' | 'dad'
    this.gameDay = GameDay.current();
    this.stats = new Statistics();
    this.marathon = new Marathon100Mode();
    this.achievementShown = false;
    this.currentMode = 'random';
    this.bestMarathonSeconds = null; // личный рекорд (переживает смену дня)

    this._loadOrInit();
  }

  _loadOrInit() {
    const data = ProfileStorage.load(this.profileId);

    // Рекорд переживает смену дня и hard reset? — НЕТ, только смену дня.
    if (data && typeof data.bestMarathonSeconds === 'number') {
      this.bestMarathonSeconds = data.bestMarathonSeconds;
    }

    // Если данных нет или день сменился — стартуем с чистого листа (кроме рекорда)
    if (!data || data.gameDay !== this.gameDay) {
      this.stats = new Statistics();
      this.marathon = new Marathon100Mode();
      this.achievementShown = false;
      this.currentMode = 'random';
      this.save();
      return;
    }

    // Восстанавливаем дневное состояние
    this.stats = Statistics.fromJSON(data.stats);
    this.marathon = Marathon100Mode.fromJSON(data.marathon);
    this.achievementShown = !!data.achievementShown;
    this.currentMode = data.currentMode || 'random';
  }

  save() {
    ProfileStorage.save(this.profileId, {
      gameDay: this.gameDay,
      stats: this.stats.toJSON(),
      marathon: this.marathon.toJSON(),
      achievementShown: this.achievementShown,
      currentMode: this.currentMode,
      bestMarathonSeconds: this.bestMarathonSeconds,
    });
  }

  /** Проверка смены дня. Возвращает true если день сменился. */
  checkDayRollover() {
    const today = GameDay.current();
    if (today !== this.gameDay) {
      this.gameDay = today;
      this.stats = new Statistics();
      this.marathon = new Marathon100Mode();
      this.achievementShown = false;
      this.currentMode = 'random';
      this.save();
      return true;
    }
    return false;
  }

  /** Обновить рекорд если текущее время лучше. Возвращает true если рекорд побит. */
  updateRecord() {
    if (!this.marathon.isFinished) return false;
    const t = this.marathon.elapsedSeconds;
    if (this.bestMarathonSeconds === null || t < this.bestMarathonSeconds) {
      this.bestMarathonSeconds = t;
      this.save();
      return true;
    }
    return false;
  }

  /** Полный сброс профиля (включая рекорд) */
  hardReset() {
    ProfileStorage.clear(this.profileId);
    this.gameDay = GameDay.current();
    this.stats = new Statistics();
    this.marathon = new Marathon100Mode();
    this.achievementShown = false;
    this.currentMode = 'random';
    this.bestMarathonSeconds = null;
    this.save();
  }

  static formatTime(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

// =============================================================
// 11. ЭКРАН ВЫБОРА ПРОФИЛЯ
// =============================================================

class ProfileSelector {
  static show(onSelect) {
    const overlay = document.getElementById('profileOverlay');
    overlay.style.display = 'flex';

    document.querySelectorAll('.profile-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.profile;
        overlay.style.display = 'none';
        document.getElementById('mainApp').style.display = '';
        onSelect(id);
      }, { once: true });
    });
  }
}

// =============================================================
// 12. ГЛАВНЫЙ КОНТРОЛЛЕР
// =============================================================

class App {
  constructor(profileId) {
    this.profile = new ProfileManager(profileId);

    // Умный рандом
    this.pool = new ExamplePool({ minFactor: 2, maxFactor: 9 });
    this.validators = new ValidatorManager()
      .add(new NoSameFirstDigitValidator(),  'noSameFirst')
      .add(new NoSameSecondDigitValidator(), 'noSameSecond')
      .add(new NoReverseExampleValidator(),  'noReverse')
      .add(new NoSameResultValidator(),      'noSameResult')
      .add(new NoRecentRepeatValidator(8),   'noRecentRepeat');
    this.smartMode = new SmartRandomMode(this.validators, 100);

    this.achievements = new DailyAchievements();

    this.currentMode = this.profile.currentMode;
    this._timerInterval = null;
    this.history  = [];
    this.current  = null;
    this.answered = false;

    this._bindUI();
    this._initFromProfile();
  }

  // -----------------------------------------------------------
  // Привязка UI
  // -----------------------------------------------------------
  _bindUI() {
    this.ui = {
      num1:        document.getElementById('num1'),
      num2:        document.getElementById('num2'),
      example:     document.getElementById('exampleDisplay'),
      input:       document.getElementById('answerInput'),
      checkBtn:    document.getElementById('checkBtn'),
      feedback:    document.getElementById('feedback'),
      resetBtn:    document.getElementById('resetBtn'),
      statTotal:   document.getElementById('statTotal'),
      statCorrect: document.getElementById('statCorrect'),
      statWrong:   document.getElementById('statWrong'),
      statPercent: document.getElementById('statPercent'),
      profileBadge:    document.getElementById('profileBadge'),
      switchProfileBtn:document.getElementById('switchProfileBtn'),
      hardResetBtn:    document.getElementById('hardResetBtn'),
      marathonRecord:  document.getElementById('marathonRecord'),
      marathonRecordValue: document.getElementById('marathonRecordValue'),
      marathonDoneBanner:  document.getElementById('marathonDoneBanner'),
      marathonDoneText:    document.getElementById('marathonDoneText'),
      taskCard:        document.getElementById('taskCard'),
    };

    this.ui.checkBtn.addEventListener('click', () => this._onCheck());
    this.ui.resetBtn.addEventListener('click', () => this._onReset());

    this.ui.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!this.answered) this._onCheck();
        else                this._nextExample();
      }
    });

    document.getElementById('btnModeRandom')
      .addEventListener('click', () => this._switchMode('random'));
    document.getElementById('btnModeMarathon')
      .addEventListener('click', () => this._switchMode('marathon'));

    document.getElementById('achievementClose')
      .addEventListener('click', () => this._closeAchievement());

    if (this.ui.switchProfileBtn) {
      this.ui.switchProfileBtn.addEventListener('click', () => {
        this._pauseAndSave();
        location.reload();
      });
    }

    if (this.ui.hardResetBtn) {
      this.ui.hardResetBtn.addEventListener('click', () => this._onHardReset());
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const rolled = this.profile.checkDayRollover();
        if (rolled) {
          location.reload();
          return;
        }
        if (this.currentMode === 'marathon' && !this.profile.marathon.isFinished) {
          this.profile.marathon.start();
        }
      } else {
        this._pauseAndSave();
      }
    });

    window.addEventListener('beforeunload', () => this._pauseAndSave());
  }

  // -----------------------------------------------------------
  // Инициализация из профиля
  // -----------------------------------------------------------
  _initFromProfile() {
    if (this.ui.profileBadge) {
      this.ui.profileBadge.textContent =
        this.profile.profileId === 'daughter' ? '👧 Дочка' : '👨 Папа';
    }

    if (this.ui.hardResetBtn) {
      this.ui.hardResetBtn.style.display =
        this.profile.profileId === 'dad' ? 'block' : 'none';
    }

    document.getElementById('btnModeRandom')
      .classList.toggle('active', this.currentMode === 'random');
    document.getElementById('btnModeMarathon')
      .classList.toggle('active', this.currentMode === 'marathon');
    document.getElementById('marathonProgress').style.display =
      this.currentMode === 'marathon' ? 'block' : 'none';

    this._updateStatsVisibility();
	this._updateStats();
    this._updateRecordBadge();

    if (this.currentMode === 'marathon') {
      this._buildMarathonGrid();
      this._restoreMarathonGridState();
      this._updateMarathonProgress();

      if (this.profile.marathon.isFinished) {
        this._showMarathonFinishedToday();
      } else {
        this.profile.marathon.start();
        this._startMarathonTimer();
        this._nextExample();
      }
    } else {
      this._nextExample();
    }
  }

  // -----------------------------------------------------------
  // Сохранение / пауза
  // -----------------------------------------------------------
  _pauseAndSave() {
    this.profile.marathon.pause();
    this.profile.currentMode = this.currentMode;
    this.profile.save();
  }

  // -----------------------------------------------------------
  // Переключение режима
  // -----------------------------------------------------------
  _switchMode(mode) {
    if (this.currentMode === mode) return;

    this._pauseAndSave();
    this._stopMarathonTimer();

    this.currentMode = mode;
    this.profile.currentMode = mode;

    document.getElementById('btnModeRandom')
      .classList.toggle('active', mode === 'random');
    document.getElementById('btnModeMarathon')
      .classList.toggle('active', mode === 'marathon');
    document.getElementById('marathonProgress').style.display =
      mode === 'marathon' ? 'block' : 'none';

    this._updateStatsVisibility();
	
	this.history = [];
    this.current = null;

    if (mode === 'marathon') {
      this._buildMarathonGrid();
      this._restoreMarathonGridState();
      this._updateMarathonProgress();
      this._updateRecordBadge();

      if (this.profile.marathon.isFinished) {
        this._showMarathonFinishedToday();
        this.profile.save();
        return;
      }

      this.profile.marathon.start();
      this._startMarathonTimer();
    } else {
      this._hideMarathonFinishedToday();
    }

    this.profile.save();
    this._nextExample();
  }

  // -----------------------------------------------------------
  // Следующий пример
  // -----------------------------------------------------------
  _nextExample() {
    this.answered = false;

    if (this.currentMode === 'marathon') {
      if (this.profile.marathon.isFinished) {
        this._showMarathonFinishedToday();
        return;
      }
      this.current = this.profile.marathon.next();
      if (this.current) this._updateMarathonGrid(this.current, null);
    } else {
      const context = { previous: this.current, history: this.history };
      this.current  = this.smartMode.next(this.pool, context);
    }

    if (!this.current) {
      this.ui.feedback.textContent = 'Нет доступных примеров!';
      return;
    }

    this.ui.num1.textContent     = this.current.a;
    this.ui.num2.textContent     = this.current.b;
    this.ui.input.value          = '';
    this.ui.input.className      = 'answer-input';
    this.ui.feedback.textContent = '';
    this.ui.feedback.className   = 'feedback';
    this.ui.checkBtn.textContent = 'Проверить';

    this.ui.example.classList.remove('animate');
    void this.ui.example.offsetWidth;
    this.ui.example.classList.add('animate');

    this.ui.input.focus();
  }

  // -----------------------------------------------------------
  // Проверка ответа
  // -----------------------------------------------------------
  _onCheck() {
    if (this.answered) {
      this._nextExample();
      return;
    }

    const raw    = this.ui.input.value.trim();
    const answer = parseInt(raw, 10);

    if (raw === '' || isNaN(answer)) {
      this.ui.feedback.textContent = 'Введи число!';
      this.ui.feedback.className   = 'feedback wrong';
      return;
    }

    this.answered = true;
    this.history.push(this.current);

    const isCorrect = (answer === this.current.result);

    if (isCorrect) {
      // Статистику ведём ТОЛЬКО в умном рандоме
      if (this.currentMode === 'random') {
        this.profile.stats.recordCorrect();
      }

      this.ui.input.classList.add('correct');
      this.ui.feedback.textContent = this._randomCorrectPhrase();
      this.ui.feedback.className   = 'feedback correct';

      if (this.currentMode === 'marathon') {
        const solved = this.current;
        this.profile.marathon.markSolved(solved);
        this._updateMarathonProgress();
        this._updateMarathonGrid(null, solved);

        if (this.profile.marathon.isFinished) {
          this._stopMarathonTimer();
          const isNewRecord = this.profile.updateRecord();
          this.profile.save();
          this._updateRecordBadge(isNewRecord);
          setTimeout(() => this._showMarathonFinish(isNewRecord), 600);
          return;
        }
      }

    } else {
      // Статистику ведём ТОЛЬКО в умном рандоме
      if (this.currentMode === 'random') {
        this.profile.stats.recordWrong();
      }

      this.ui.input.classList.add('wrong');
      this.ui.feedback.textContent =
        `Неверно. ${this.current.a} × ${this.current.b} = ${this.current.result}`;
      this.ui.feedback.className = 'feedback wrong';

      if (this.currentMode === 'marathon') {
        this.profile.marathon.markFailed();
      }
    }

    this.ui.checkBtn.textContent = 'Дальше →';

    // Обновляем статы и проверяем ачивки ТОЛЬКО в умном рандоме
    if (this.currentMode === 'random') {
      this._updateStats();
      this._checkAndShowAchievement();
    }

    this.profile.save();
  }

    // -----------------------------------------------------------
  // Сброс прогресса ТЕКУЩЕГО режима (кнопка "Начать заново")
  // -----------------------------------------------------------
  _onReset() {
    this.history = [];
    this.current = null;

    if (this.currentMode === 'random') {
      // Сбрасываем только статистику умного рандома и флаг ачивки
      this.profile.stats.reset();
      this.profile.achievementShown = false;
      this._updateStats();

    } else if (this.currentMode === 'marathon') {
      // Сбрасываем только марафон, статистику умного рандома не трогаем
      this._stopMarathonTimer();
      this.profile.marathon.reset();
      this._hideMarathonFinishedToday();
      this._buildMarathonGrid();
      this._updateMarathonProgress();
      this.profile.marathon.start();
      this._startMarathonTimer();
    }

    this.profile.save();
    this._nextExample();
  }

  // -----------------------------------------------------------
  // Hard reset (только папа) — обнулить ВСЁ включая рекорд
  // -----------------------------------------------------------
  _onHardReset() {
    if (!confirm('Полностью обнулить прогресс этого профиля?\n(Включая личный рекорд)')) return;

    this.profile.hardReset();
    this._stopMarathonTimer();
    this.history = [];
    this.current = null;
    this.currentMode = 'random';

    document.getElementById('btnModeRandom').classList.add('active');
    document.getElementById('btnModeMarathon').classList.remove('active');
    document.getElementById('marathonProgress').style.display = 'none';
    this._updateStatsVisibility();
	this._hideMarathonFinishedToday();

    this._updateStats();
    this._updateRecordBadge();
    this._nextExample();
  }

  // -----------------------------------------------------------
  // Статистика
  // -----------------------------------------------------------
  _updateStats() {
    const s = this.profile.stats;
    this.ui.statTotal.textContent   = s.total;
    this.ui.statCorrect.textContent = s.correct;
    this.ui.statWrong.textContent   = s.wrong;
    this.ui.statPercent.textContent =
      s.accuracy !== null ? `${s.accuracy}%` : '—';
  }
  
   _updateStatsVisibility() {
    const statsEl = document.getElementById('stats');
    if (statsEl) {
      statsEl.style.display = (this.currentMode === 'random') ? '' : 'none';
    }
  }

  // -----------------------------------------------------------
  // Бейдж рекорда
  // -----------------------------------------------------------
  _updateRecordBadge(isNew = false) {
    if (!this.ui.marathonRecord) return;
    const best = this.profile.bestMarathonSeconds;
    if (best === null) {
      this.ui.marathonRecord.style.display = 'none';
      return;
    }
    this.ui.marathonRecord.style.display = 'block';
    this.ui.marathonRecordValue.textContent = ProfileManager.formatTime(best);
    if (isNew) {
      this.ui.marathonRecord.classList.add('marathon-record-new');
      setTimeout(() => {
        this.ui.marathonRecord.classList.remove('marathon-record-new');
      }, 1500);
    }
  }

  // -----------------------------------------------------------
  // Баннер "марафон сегодня завершён"
  // -----------------------------------------------------------
  _showMarathonFinishedToday() {
    this._stopMarathonTimer();
    if (this.ui.marathonDoneBanner) {
      this.ui.marathonDoneBanner.style.display = 'flex';
      this.ui.marathonDoneText.textContent =
        `⏱ Время: ${this.profile.marathon.elapsedFormatted}`;
    }
    // Прячем карточку с примером и кнопкой
    if (this.ui.taskCard) this.ui.taskCard.style.display = 'none';
  }

  _hideMarathonFinishedToday() {
    if (this.ui.marathonDoneBanner) {
      this.ui.marathonDoneBanner.style.display = 'none';
    }
    if (this.ui.taskCard) this.ui.taskCard.style.display = '';
  }

  // -----------------------------------------------------------
  // Ачивки
  // -----------------------------------------------------------
  _checkAndShowAchievement() {
    if (this.profile.achievementShown) return;
    const level = this.achievements.checkAchievement(this.profile.stats);
    if (!level) return;

    this.profile.achievementShown = true;
    this.profile.save();

    const data = this.achievements.getRewardData(level);
    this._showAchievementModal({
      tier:    data.tier,
      topText: data.tier === 'gold' ? '🥇 Золото' : '🥈 Серебро',
      bigEmoji: data.tier === 'gold' ? '🏆' : '🎉',
      title:   data.title,
      message: data.message,
      secret:  data.emoji,
      hint:    'Отправь его папе! 📱',
    });
  }

  _showMarathonFinish(isNewRecord) {
    const recordLine = isNewRecord ? '\n🏅 НОВЫЙ РЕКОРД!' : '';
    this._showAchievementModal({
      tier:    'gold',
      topText: '🏁 Марафон завершён!',
      bigEmoji: '🎓',
      title:   'Все 100 примеров решены!',
      message: `⏱ Время: ${this.profile.marathon.elapsedFormatted}\n❌ Ошибок: ${this.profile.stats.wrong}\n🎯 Точность: ${this.profile.stats.accuracy}%${recordLine}`,
      secret:  this.achievements.getPerfectEmoji(),
      hint:    'Отправь папе результат! 📱',
    });

    // После закрытия ачивки — показать баннер "завершено сегодня"
    const closeBtn = document.getElementById('achievementClose');
    const handler = () => {
      this._showMarathonFinishedToday();
      closeBtn.removeEventListener('click', handler);
    };
    closeBtn.addEventListener('click', handler);
  }

  _showAchievementModal({ tier, topText, bigEmoji, title, message, secret, hint }) {
    document.getElementById('achievementModal').className = `achievement-modal ${tier}`;
    document.getElementById('achievementTier').textContent      = topText;
    document.getElementById('achievementBigEmoji').textContent  = bigEmoji;
    document.getElementById('achievementTitle').textContent     = title;
    document.getElementById('achievementMessage').textContent   = message;
    document.getElementById('secretEmoji').textContent          = secret;
    document.querySelector('.secret-hint').textContent          = hint;
    document.getElementById('achievementOverlay').style.display = 'flex';
  }

  _closeAchievement() {
    document.getElementById('achievementOverlay').style.display = 'none';
  }

  // -----------------------------------------------------------
  // Марафон — сетка и прогресс
  // -----------------------------------------------------------
  _buildMarathonGrid() {
    const grid = document.getElementById('marathonGrid');
    grid.innerHTML = '';
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const cell = document.createElement('div');
        cell.className   = 'marathon-cell';
        cell.id          = `cell-${a}-${b}`;
        cell.title       = '';
        cell.textContent = '';
        grid.appendChild(cell);
      }
    }
  }

 /** Восстановить визуальное состояние сетки из сохранённого марафона */
  _restoreMarathonGridState() {
    for (const ex of this.profile.marathon.solvedList) {
      const cell = document.getElementById(`cell-${ex.a}-${ex.b}`);
      if (cell) {
        cell.classList.add('solved');
        cell.textContent = '✓';
      }
    }
  }

  _updateMarathonGrid(current, justSolved) {
    document.querySelectorAll('.marathon-cell.current')
      .forEach(c => c.classList.remove('current'));

    if (current) {
      const cell = document.getElementById(`cell-${current.a}-${current.b}`);
      if (cell && !cell.classList.contains('solved')) {
        cell.classList.add('current');
      }
    }

    if (justSolved) {
      const cell = document.getElementById(`cell-${justSolved.a}-${justSolved.b}`);
      if (cell) {
        cell.classList.remove('current');
        cell.classList.add('solved');
        cell.textContent = '✓';
      }
    }
  }

  _updateMarathonProgress() {
    document.getElementById('marathonSolved').textContent  = this.profile.marathon.solvedCount;
    document.getElementById('marathonLeft').textContent    = this.profile.marathon.pendingCount;
    document.getElementById('marathonBarFill').style.width = `${this.profile.marathon.progressPercent}%`;
  }

  // -----------------------------------------------------------
  // Таймер
  // -----------------------------------------------------------
  _startMarathonTimer() {
    this._stopMarathonTimer();
    this._timerInterval = setInterval(() => {
      document.getElementById('marathonTimer').textContent =
        this.profile.marathon.elapsedFormatted;
    }, 1000);
    // Сразу обновим, чтобы не ждать секунду
    document.getElementById('marathonTimer').textContent =
      this.profile.marathon.elapsedFormatted;
  }

  _stopMarathonTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  // -----------------------------------------------------------
  // Похвала
  // -----------------------------------------------------------
  _randomCorrectPhrase() {
    const phrases = [
      '✅ Верно!', '🎉 Отлично!', '🌟 Молодец!',
      '👍 Правильно!', '🔥 Супер!', '💪 Так держать!',
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
}

// =============================================================
// ЗАПУСК
// =============================================================
document.addEventListener('DOMContentLoaded', () => {
  ProfileSelector.show((profileId) => {
    window.app = new App(profileId);
  });
});