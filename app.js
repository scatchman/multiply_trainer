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
    this._started  = null;
    this._finished = null;

    for (let a = 1; a <= 10; a++)
      for (let b = 1; b <= 10; b++)
        this._pending.push(new Example(a, b));
  }

  start() {
    if (!this._started) this._started = new Date();
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
    if (this._pending.length === 0) this._finished = new Date();
  }

  markFailed() { /* пример остаётся в пуле */ }

  get solvedCount()      { return this._solved.length; }
  get pendingCount()     { return this._pending.length; }
  get isFinished()       { return this._pending.length === 0; }
  get progressPercent()  { return Math.round(this._solved.length / 100 * 100); }

  get elapsedSeconds() {
    if (!this._started) return 0;
    return Math.floor(((this._finished ?? new Date()) - this._started) / 1000);
  }

  get elapsedFormatted() {
    const m = Math.floor(this.elapsedSeconds / 60);
    const s = this.elapsedSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
// 8. ГЛАВНЫЙ КОНТРОЛЛЕР
// =============================================================

class App {
  constructor() {
    // Умный рандом
    this.pool = new ExamplePool({ minFactor: 2, maxFactor: 9 });
    this.validators = new ValidatorManager()
      .add(new NoSameFirstDigitValidator(),  'noSameFirst')
      .add(new NoSameSecondDigitValidator(), 'noSameSecond')
      .add(new NoReverseExampleValidator(),  'noReverse')
      .add(new NoSameResultValidator(),      'noSameResult')
      .add(new NoRecentRepeatValidator(8),   'noRecentRepeat');
    this.smartMode = new SmartRandomMode(this.validators, 100);

    // Марафон
    this.marathonMode = new Marathon100Mode();

    // Текущий режим: 'random' | 'marathon'
    this.currentMode = 'random';
    this._timerInterval = null;

    // Статистика и ачивки
    this.stats            = new Statistics();
    this.achievements     = new DailyAchievements();
    this.achievementShown = false;

    // Состояние
    this.history  = [];
    this.current  = null;
    this.answered = false;

    this._bindUI();
    this._nextExample();
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
    };

    this.ui.checkBtn.addEventListener('click', () => this._onCheck());
    this.ui.resetBtn.addEventListener('click', () => this._onReset());

    this.ui.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!this.answered) this._onCheck();
        else                this._nextExample();
      }
    });

    // Переключатель режимов
    document.getElementById('btnModeRandom')
      .addEventListener('click', () => this._switchMode('random'));
    document.getElementById('btnModeMarathon')
      .addEventListener('click', () => this._switchMode('marathon'));

    // Закрытие ачивки
    document.getElementById('achievementClose')
      .addEventListener('click', () => this._closeAchievement());
  }

  // -----------------------------------------------------------
  // Переключение режима
  // -----------------------------------------------------------
  _switchMode(mode) {
    if (this.currentMode === mode) return;
    this.currentMode = mode;

    document.getElementById('btnModeRandom')
      .classList.toggle('active', mode === 'random');
    document.getElementById('btnModeMarathon')
      .classList.toggle('active', mode === 'marathon');

    document.getElementById('marathonProgress').style.display =
      mode === 'marathon' ? 'block' : 'none';

    // Сброс
    this.stats.reset();
    this.history          = [];
    this.current          = null;
    this.achievementShown = false;
    this._updateStats();
    this._stopMarathonTimer();

    if (mode === 'marathon') {
      this.marathonMode.reset();
      this._buildMarathonGrid();
      this.marathonMode.start();
      this._startMarathonTimer();
    }

    this._nextExample();
  }

  // -----------------------------------------------------------
  // Следующий пример
  // -----------------------------------------------------------
  _nextExample() {
    this.answered = false;

    if (this.currentMode === 'marathon') {
      this.current = this.marathonMode.next();
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

    if (answer === this.current.result) {
      this.stats.recordCorrect();
      this.ui.input.classList.add('correct');
      this.ui.feedback.textContent = this._randomCorrectPhrase();
      this.ui.feedback.className   = 'feedback correct';

      if (this.currentMode === 'marathon') {
        const solved = this.current;
        this.marathonMode.markSolved(solved);
        this._updateMarathonProgress();
        this._updateMarathonGrid(null, solved);

        if (this.marathonMode.isFinished) {
          this._stopMarathonTimer();
          setTimeout(() => this._showMarathonFinish(), 600);
          return;
        }
      }

    } else {
      this.stats.recordWrong();
      this.ui.input.classList.add('wrong');
      this.ui.feedback.textContent =
        `Неверно. ${this.current.a} × ${this.current.b} = ${this.current.result}`;
      this.ui.feedback.className = 'feedback wrong';

      if (this.currentMode === 'marathon') {
        this.marathonMode.markFailed();
      }
    }

    this.ui.checkBtn.textContent = 'Дальше →';
    this._updateStats();
    this._checkAndShowAchievement();
  }

  // -----------------------------------------------------------
  // Сброс
  // -----------------------------------------------------------
  _onReset() {
    this.stats.reset();
    this.history          = [];
    this.current          = null;
    this.achievementShown = false;
    this._stopMarathonTimer();

    if (this.currentMode === 'marathon') {
      this.marathonMode.reset();
      this._buildMarathonGrid();
      this._updateMarathonProgress();
      this.marathonMode.start();
      this._startMarathonTimer();
    }

    this._updateStats();
    this._nextExample();
  }

  // -----------------------------------------------------------
  // Статистика
  // -----------------------------------------------------------
  _updateStats() {
    this.ui.statTotal.textContent   = this.stats.total;
    this.ui.statCorrect.textContent = this.stats.correct;
    this.ui.statWrong.textContent   = this.stats.wrong;
    this.ui.statPercent.textContent =
      this.stats.accuracy !== null ? `${this.stats.accuracy}%` : '—';
  }

  // -----------------------------------------------------------
  // Ачивки
  // -----------------------------------------------------------
  _checkAndShowAchievement() {
    if (this.achievementShown) return;
    const level = this.achievements.checkAchievement(this.stats);
    if (!level) return;

    this.achievementShown = true;
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

  _showMarathonFinish() {
    this._showAchievementModal({
      tier:    'gold',
      topText: '🏁 Марафон завершён!',
      bigEmoji: '🎓',
      title:   'Все 100 примеров решены!',
      message: `⏱ Время: ${this.marathonMode.elapsedFormatted}\n❌ Ошибок: ${this.stats.wrong}\n🎯 Точность: ${this.stats.accuracy}%`,
      secret:  this.achievements.getPerfectEmoji(),
      hint:    'Отправь папе результат! 📱',
    });
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
		  cell.title       = '';        // ← убираем подсказку при наведении
		  cell.textContent = '';        // ← никаких цифр
		  grid.appendChild(cell);
		}
	  }
	}

  _updateMarathonGrid(current, justSolved) {
    // Убираем current подсветку везде
    document.querySelectorAll('.marathon-cell.current')
      .forEach(c => c.classList.remove('current'));

    // Подсвечиваем текущий
    if (current) {
      const cell = document.getElementById(`cell-${current.a}-${current.b}`);
      if (cell && !cell.classList.contains('solved')) {
        cell.classList.add('current');
      }
    }

    // Помечаем решённый
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
    document.getElementById('marathonSolved').textContent  = this.marathonMode.solvedCount;
    document.getElementById('marathonLeft').textContent    = this.marathonMode.pendingCount;
    document.getElementById('marathonBarFill').style.width = `${this.marathonMode.progressPercent}%`;
  }

  // -----------------------------------------------------------
  // Таймер
  // -----------------------------------------------------------
  _startMarathonTimer() {
    this._stopMarathonTimer();
    this._timerInterval = setInterval(() => {
      document.getElementById('marathonTimer').textContent =
        this.marathonMode.elapsedFormatted;
    }, 1000);
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
  window.app = new App();
});