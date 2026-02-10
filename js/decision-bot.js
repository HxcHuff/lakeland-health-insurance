(function () {
  const DECISION_BOT_VERSION = '1.0';

  const QUESTIONS = [
    {
      key: 'need',
      label: 'What are you shopping for?',
      type: 'choice',
      options: [
        { value: 'ACA', label: 'ACA' },
        { value: 'Medicare', label: 'Medicare' },
        { value: 'Not sure', label: 'Not sure' }
      ]
    },
    {
      key: 'zip',
      label: 'What ZIP code?',
      type: 'text',
      placeholder: '33805',
      maxLength: 5
    },
    {
      key: 'household',
      label: 'Household size?',
      type: 'choice',
      options: [1, 2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: String(value) }))
    },
    {
      key: 'income',
      label: 'Estimated yearly household income?',
      type: 'choice',
      options: [
        { value: '<20k', label: '<20k' },
        { value: '20-35k', label: '20-35k' },
        { value: '35-55k', label: '35-55k' },
        { value: '55-80k', label: '55-80k' },
        { value: '80k+', label: '80k+' }
      ]
    },
    {
      key: 'docs',
      label: 'Do you need to keep specific doctors?',
      type: 'choice',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' }
      ]
    },
    {
      key: 'rx',
      label: 'Any expensive prescriptions?',
      type: 'choice',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' }
      ]
    }
  ];

  function buildStyles() {
    if (document.getElementById('decision-bot-styles')) return;

    const style = document.createElement('style');
    style.id = 'decision-bot-styles';
    style.textContent = `
      .decision-bot {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #dbeafe;
        box-shadow: 0 16px 36px rgba(30, 58, 138, 0.12);
        padding: 1.25rem;
        margin: 1.5rem 0;
      }
      .decision-bot__eyebrow {
        display: inline-block;
        background: #eff6ff;
        color: #1e40af;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        margin-bottom: 0.75rem;
        text-transform: uppercase;
      }
      .decision-bot h3 {
        margin: 0 0 0.4rem;
        color: #1e3a8a;
        font-size: 1.25rem;
      }
      .decision-bot__lead {
        margin: 0 0 1rem;
        color: #475569;
        line-height: 1.5;
      }
      .decision-bot__progress {
        margin: 0 0 0.75rem;
        font-size: 0.86rem;
        color: #1e3a8a;
        font-weight: 600;
      }
      .decision-bot__question {
        margin: 0 0 0.8rem;
        color: #0f172a;
        font-size: 1.05rem;
        font-weight: 700;
      }
      .decision-bot__options {
        display: grid;
        gap: 0.55rem;
        margin-bottom: 1rem;
      }
      .decision-bot__option,
      .decision-bot__next,
      .decision-bot__back,
      .decision-bot__cta,
      .decision-bot__secondary {
        border-radius: 10px;
        border: 1px solid #bfdbfe;
        background: #f8fbff;
        color: #1e3a8a;
        font-weight: 600;
        font-size: 0.98rem;
        padding: 0.7rem 0.9rem;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
        text-align: center;
      }
      .decision-bot__option:hover,
      .decision-bot__next:hover,
      .decision-bot__cta:hover,
      .decision-bot__secondary:hover {
        transform: translateY(-1px);
        border-color: #60a5fa;
      }
      .decision-bot__option.is-active {
        background: #1e3a8a;
        border-color: #1e3a8a;
        color: #ffffff;
      }
      .decision-bot__zip {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 1rem;
      }
      .decision-bot__actions {
        display: flex;
        gap: 0.6rem;
      }
      .decision-bot__next {
        background: #1e3a8a;
        border-color: #1e3a8a;
        color: #fff;
        flex: 1;
      }
      .decision-bot__back {
        background: #fff;
      }
      .decision-bot__result {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1rem;
      }
      .decision-bot__result h4 {
        margin: 0 0 0.55rem;
        color: #1e3a8a;
      }
      .decision-bot__result p {
        margin: 0 0 0.8rem;
        color: #334155;
      }
      .decision-bot__cta {
        display: inline-block;
        width: 100%;
        background: linear-gradient(135deg, #1e3a8a, #3b82f6);
        border: none;
        color: #ffffff;
        margin-bottom: 0.6rem;
      }
      .decision-bot__secondary-wrap {
        display: grid;
        gap: 0.5rem;
        grid-template-columns: 1fr;
      }
      .decision-bot__summary {
        font-size: 0.82rem;
        color: #64748b;
        margin-top: 0.5rem;
        word-break: break-word;
      }
      @media (min-width: 640px) {
        .decision-bot { padding: 1.5rem; }
        .decision-bot__secondary-wrap { grid-template-columns: repeat(2, 1fr); }
      }
    `;
    document.head.appendChild(style);
  }

  function summarize(answers) {
    const need = answers.need === 'Not sure' ? 'ACA likely' : answers.need;
    return `DecisionBot: Need=${need || 'n/a'}; ZIP=${answers.zip || 'n/a'}; HH=${answers.household || 'n/a'}; Income=${answers.income || 'n/a'}; Docs=${answers.docs || 'n/a'}; Rx=${answers.rx || 'n/a'}`;
  }

  function buildResult(answers) {
    if (answers.need === 'Medicare') {
      return {
        title: 'Medicare path',
        body: 'Sounds like you’re in Medicare shopping mode. Next step is comparing plans for doctors, prescriptions, and total yearly costs—not just the monthly premium. We can walk this with you quickly and keep it simple.'
      };
    }

    if (answers.need === 'Not sure') {
      return {
        title: 'We’ll guide you (ACA likely)',
        body: 'No worries—most people start here. Based on what you shared, ACA is the likely lane unless you intentionally choose Medicare. We’ll help you narrow options by budget, doctor access, and medication needs in plain English.'
      };
    }

    return {
      title: 'ACA likely',
      body: 'Based on your answers, ACA coverage is likely the right first path to review. We’ll focus on balancing premium, deductible, doctor network, and prescription fit so you can choose with confidence. Quick, clear, and no jargon overload.'
    };
  }

  function setSummaryValue(targetId, summary) {
    if (!targetId) return;
    const field = document.getElementById(targetId);
    if (field) field.value = summary;
  }

  function scrollToTarget(targetSelector) {
    if (!targetSelector) {
      window.location.href = '/contact/#form';
      return;
    }

    const target = document.querySelector(targetSelector);
    if (!target) {
      window.location.href = '/contact/#form';
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (target.tagName === 'FORM') {
      const firstInput = target.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus({ preventScroll: true });
    }
  }

  function renderQuestion(container, state) {
    const question = QUESTIONS[state.step];
    const total = QUESTIONS.length;

    const progress = document.createElement('p');
    progress.className = 'decision-bot__progress';
    progress.textContent = `Question ${state.step + 1} of ${total}`;

    const title = document.createElement('p');
    title.className = 'decision-bot__question';
    title.textContent = question.label;

    container.appendChild(progress);
    container.appendChild(title);

    if (question.type === 'choice') {
      const options = document.createElement('div');
      options.className = 'decision-bot__options';

      question.options.forEach((option) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'decision-bot__option';
        btn.textContent = option.label;

        if (state.answers[question.key] === option.value) {
          btn.classList.add('is-active');
        }

        btn.addEventListener('click', function () {
          state.answers[question.key] = option.value;
          if (state.step < total - 1) {
            state.step += 1;
          } else {
            state.complete = true;
          }
          rerender(container, state);
        });

        options.appendChild(btn);
      });

      container.appendChild(options);
    }

    if (question.type === 'text') {
      const input = document.createElement('input');
      input.className = 'decision-bot__zip';
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = question.maxLength;
      input.placeholder = question.placeholder;
      input.value = state.answers[question.key] || '';
      input.setAttribute('aria-label', question.label);

      input.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 5);
      });

      const actions = document.createElement('div');
      actions.className = 'decision-bot__actions';

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'decision-bot__next';
      next.textContent = 'Next';
      next.addEventListener('click', function () {
        if (input.value.length !== 5) {
          input.focus();
          return;
        }
        state.answers[question.key] = input.value;
        state.step += 1;
        rerender(container, state);
      });

      if (state.step > 0) {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'decision-bot__back';
        back.textContent = 'Back';
        back.addEventListener('click', function () {
          state.step -= 1;
          rerender(container, state);
        });
        actions.appendChild(back);
      }

      actions.appendChild(next);
      container.appendChild(input);
      container.appendChild(actions);
      return;
    }

    if (state.step > 0) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'decision-bot__back';
      back.textContent = 'Back';
      back.addEventListener('click', function () {
        state.step -= 1;
        rerender(container, state);
      });
      container.appendChild(back);
    }
  }

  function renderResult(container, state) {
    const result = buildResult(state.answers);
    const summary = summarize(state.answers);
    const targetSelector = state.host.dataset.formTarget;
    const summaryTarget = state.host.dataset.summaryTarget;

    const resultWrap = document.createElement('div');
    resultWrap.className = 'decision-bot__result';

    const heading = document.createElement('h4');
    heading.textContent = result.title;

    const body = document.createElement('p');
    body.textContent = result.body;

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'decision-bot__cta';
    cta.textContent = 'Get my 2-minute Insurance Checkup';
    cta.addEventListener('click', function () {
      setSummaryValue(summaryTarget, summary);
      scrollToTarget(targetSelector);
    });

    const secondaryWrap = document.createElement('div');
    secondaryWrap.className = 'decision-bot__secondary-wrap';

    const callBtn = document.createElement('a');
    callBtn.className = 'decision-bot__secondary';
    callBtn.href = 'tel:+18636403102';
    callBtn.textContent = '📞 Click to Call';

    const textBtn = document.createElement('a');
    textBtn.className = 'decision-bot__secondary';
    textBtn.href = 'sms:+18636403102?body=Hi%20David!%20I%20just%20used%20the%20Decision%20Bot%20and%20want%20a%202-minute%20Insurance%20Checkup.';
    textBtn.textContent = '📱 Click to Text';

    const summaryText = document.createElement('p');
    summaryText.className = 'decision-bot__summary';
    summaryText.textContent = summary;

    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'decision-bot__back';
    restart.textContent = 'Start over';
    restart.addEventListener('click', function () {
      state.step = 0;
      state.complete = false;
      state.answers = {};
      rerender(container, state);
    });

    secondaryWrap.appendChild(callBtn);
    secondaryWrap.appendChild(textBtn);

    resultWrap.appendChild(heading);
    resultWrap.appendChild(body);
    resultWrap.appendChild(cta);
    resultWrap.appendChild(secondaryWrap);
    resultWrap.appendChild(summaryText);
    resultWrap.appendChild(restart);
    container.appendChild(resultWrap);
  }

  function rerender(container, state) {
    container.innerHTML = '';

    if (state.complete) {
      renderResult(container, state);
      return;
    }

    renderQuestion(container, state);
  }

  function mountDecisionBot(host) {
    const wrapper = document.createElement('div');
    wrapper.className = 'decision-bot';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'decision-bot__eyebrow';
    eyebrow.textContent = 'Decision Bot';

    const heading = document.createElement('h3');
    heading.textContent = 'Find your best starting path in under 2 minutes';

    const lead = document.createElement('p');
    lead.className = 'decision-bot__lead';
    lead.textContent = 'Answer 6 quick questions and we’ll point you to the right lane—without the insurance circus.';

    const stage = document.createElement('div');

    wrapper.appendChild(eyebrow);
    wrapper.appendChild(heading);
    wrapper.appendChild(lead);
    wrapper.appendChild(stage);
    host.appendChild(wrapper);

    const state = {
      host: host,
      step: 0,
      complete: false,
      answers: {}
    };

    rerender(stage, state);
  }

  function initDecisionBots() {
    buildStyles();
    document.querySelectorAll('[data-decision-bot]').forEach(function (host) {
      if (host.dataset.decisionBotMounted === 'true') return;
      host.dataset.decisionBotMounted = 'true';
      mountDecisionBot(host);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDecisionBots);
  } else {
    initDecisionBots();
  }

  window.__DECISION_BOT_VERSION__ = DECISION_BOT_VERSION;
})();
