/*
  Mapeamento central de sprites do cachorro.
  Se os nomes dos arquivos mudarem, ajuste apenas aqui.
*/
const SPRITES = {
  default: "./assets/dog/padrao.png",
  tail1: "./assets/dog/rabo1.png",
  tail2: "./assets/dog/rabo2.png",
  stand1: "./assets/dog/empe1.png",
  stand2: "./assets/dog/empe2.png",
  eat: "./assets/dog/come.png",
  choke: "./assets/dog/engasga.png",
  spit: "./assets/dog/escarra.png"
};

/*
  Configuração geral de tempo (em ms).
  frameDelay começa em 500ms conforme solicitado.
*/
const ANIMATION_CONFIG = {
  frameDelay: 500,
  eatFrameDelay: 1000,
  idleHoldFrames: 3,
  sequenceGapFrames: 1,
  debugMode: true
};

/*
  Timeline automática: apenas idle + sequências automáticas (tail/stand).
  A repetição de idle mantém o cachorro majoritariamente no estado padrão.
*/
const AUTO_TIMELINE = [
  "idle",
  "idle",
  "tail",
  "idle",
  "idle",
  "idle",
  "stand",
  "idle",
  "idle",
  "idle"
];

const dogSprite = document.getElementById("dogSprite");
const feedButton = document.getElementById("feedButton");

class DogAnimator {
  constructor(spriteElement, sprites, config) {
    this.spriteElement = spriteElement;
    this.sprites = sprites;
    this.config = config;

    this.running = false;
    this.currentState = "default";

    this.autoIndex = 0;
    this.manualQueue = [];
  }

  preloadAll() {
    Object.values(this.sprites).forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }

  setState(stateName) {
    const src = this.sprites[stateName];
    if (!src || !this.spriteElement) {
      return;
    }

    this.currentState = stateName;
    this.spriteElement.src = src;
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async playFrame(stateName, delay = this.config.frameDelay) {
    this.setState(stateName);
    await this.wait(delay);
  }

  /*
    Toda sequência começa e termina em default.
    Isso padroniza o comportamento e evita transições quebradas.
  */
  async playSequence(frames) {
    await this.playFrame("default");

    for (const frame of frames) {
      await this.playFrame(frame);
    }

    await this.playFrame("default");
    await this.wait(this.config.frameDelay * this.config.sequenceGapFrames);
  }

  /* ========================
     Sequências automáticas
     ======================== */

  async playIdle() {
    this.setState("default");
    await this.wait(this.config.frameDelay * this.config.idleHoldFrames);
  }

  /* default -> tail1 -> tail2 -> tail1 -> default */
  async playTail() {
    await this.playSequence(["tail1", "tail2", "tail1"]);
  }

  /* default -> stand1 -> stand2 -> stand1 -> default */
  async playStand() {
    await this.playSequence(["stand1", "stand2", "stand1"]);
  }

  async runAutomaticStep() {
    const step = AUTO_TIMELINE[this.autoIndex % AUTO_TIMELINE.length];
    this.autoIndex += 1;

    if (step === "tail") {
      await this.playTail();
      return;
    }

    if (step === "stand") {
      await this.playStand();
      return;
    }

    await this.playIdle();
  }

  /* ========================
     Sequências manuais
     ======================== */

  /* default -> eat -> default */
  async playEat() {
    await this.playFrame("default");
    await this.playFrame("eat", this.config.eatFrameDelay);
    await this.playFrame("default");
    await this.wait(this.config.frameDelay * this.config.sequenceGapFrames);
  }

  /* default -> choke -> spit -> default */
  async playChokeSpit() {
    await this.playSequence(["choke", "spit"]);
  }

  enqueueManual(sequenceName, options = {}) {
    const { priority = false } = options;

    // Apenas sequências manuais aceitas aqui.
    if (sequenceName !== "eat" && sequenceName !== "chokeSpit") {
      return;
    }

    if (priority) {
      this.manualQueue.unshift(sequenceName);
      return;
    }

    this.manualQueue.push(sequenceName);
  }

  async runManualSequence(sequenceName) {
    if (sequenceName === "eat") {
      await this.playEat();
      return;
    }

    if (sequenceName === "chokeSpit") {
      await this.playChokeSpit();
    }
  }

  async start() {
    if (this.running || !this.spriteElement) {
      return;
    }

    this.running = true;
    this.preloadAll();
    this.setState("default");

    while (this.running) {
      if (this.manualQueue.length > 0) {
        const manualSequence = this.manualQueue.shift();
        await this.runManualSequence(manualSequence);
        continue;
      }

      await this.runAutomaticStep();
    }
  }

  stop() {
    this.running = false;
    this.setState("default");
  }

  getStatus() {
    return {
      running: this.running,
      currentState: this.currentState,
      manualQueue: [...this.manualQueue],
      nextAutoStep: AUTO_TIMELINE[this.autoIndex % AUTO_TIMELINE.length]
    };
  }
}

const animator = new DogAnimator(dogSprite, SPRITES, ANIMATION_CONFIG);
animator.start();

function setupFeedButton(animatorInstance) {
  if (!feedButton) {
    return;
  }

  /*
    Integração mínima desta etapa:
    clique no botão => dispara sequência manual de comer.
    (default -> eat -> default)
  */
  feedButton.addEventListener("click", () => {
    animatorInstance.enqueueManual("eat", { priority: true });
  });
}

setupFeedButton(animator);

function createDebugOverlay() {
  const panel = document.createElement("div");
  panel.setAttribute("id", "debugPanel");
  panel.style.position = "fixed";
  panel.style.left = "12px";
  panel.style.bottom = "12px";
  panel.style.zIndex = "9999";
  panel.style.padding = "10px 12px";
  panel.style.borderRadius = "10px";
  panel.style.background = "rgba(10, 12, 16, 0.82)";
  panel.style.color = "#e9f0ff";
  panel.style.fontFamily = "monospace";
  panel.style.fontSize = "12px";
  panel.style.lineHeight = "1.45";
  panel.style.maxWidth = "330px";
  panel.style.pointerEvents = "none";

  document.body.appendChild(panel);
  return panel;
}

function setupDebugMode(animatorInstance) {
  if (!ANIMATION_CONFIG.debugMode) {
    return;
  }

  const debugPanel = createDebugOverlay();

  const renderDebugInfo = () => {
    const { running, currentState, manualQueue, nextAutoStep } = animatorInstance.getStatus();
    debugPanel.textContent =
      "[DEBUG] 1:tail(auto) 2:stand(auto) E:eat(manual) C:choke+spit(manual) S:start/stop\n" +
      `running: ${running ? "yes" : "no"} | state: ${currentState} | nextAuto: ${nextAutoStep}\n` +
      `manualQueue: ${manualQueue.length > 0 ? manualQueue.join(", ") : "(empty)"}`;
  };

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    /*
      Teclas de debug:
      - 1 e 2 alteram o próximo passo automático imediato (sem quebrar blocos)
      - E e C enfileiram sequências manuais
    */
    if (key === "1") animatorInstance.autoIndex = 2; // próximo ciclo cai em "tail"
    if (key === "2") animatorInstance.autoIndex = 6; // próximo ciclo cai em "stand"
    if (key === "e") animatorInstance.enqueueManual("eat", { priority: true });
    if (key === "c") animatorInstance.enqueueManual("chokeSpit");

    if (key === "s") {
      if (animatorInstance.running) {
        animatorInstance.stop();
      } else {
        animatorInstance.start();
      }
    }

    renderDebugInfo();
  });

  setInterval(renderDebugInfo, 200);
  renderDebugInfo();
}

setupDebugMode(animator);

/* API pública para integração futura sem acoplar lógica de jogo agora */
window.dogAnimation = {
  start: () => animator.start(),
  stop: () => animator.stop(),

  /* Disparos manuais (futuro: clique em botões/eventos) */
  triggerEat: () => animator.enqueueManual("eat", { priority: true }),
  triggerChokeSpit: () => animator.enqueueManual("chokeSpit"),

  /* Exposição de automáticas para ajuste futuro */
  playTailAuto: () => (animator.autoIndex = 2),
  playStandAuto: () => (animator.autoIndex = 6)
};
