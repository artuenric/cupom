/*
  Logica isolada do cachorro:
  - mapa de sprites
  - configuracao de tempos
  - fluxo automatico aleatorio
  - fila manual com prioridade para eat
*/

(() => {
  const DOG_SPRITES = {
    default: "./assets/dog/padrao.png",
    tail1: "./assets/dog/rabo1.png",
    tail2: "./assets/dog/rabo2.png",
    stand1: "./assets/dog/empe1.png",
    stand2: "./assets/dog/empe2.png",
    tongue: "./assets/dog/lingua.png",
    opa: "./assets/dog/opa.png",
    eat: "./assets/dog/come.png",
    choke: "./assets/dog/engasga.png",
    spit: "./assets/dog/escarra.png"
  };

  const DOG_ANIMATION_CONFIG = {
    frameDelay: 500,
    defaultDelay: 500,
    tongueDelay: 1000,
    eatFrameDelay: 1000,
    debugMode: false
  };

  const DOG_AUTO_STEPS = ["default", "tail", "opa", "tongue", "stand"];

  class DogAnimator {
    constructor(spriteElement, sprites, config, autoSteps) {
      this.spriteElement = spriteElement;
      this.sprites = sprites;
      this.config = config;
      this.autoSteps = autoSteps;

      this.running = false;
      this.currentState = "default";
      this.manualQueue = [];
      this.listeners = new Map();
      this.lastAutoStep = null;
      this.nextAutoStepOverride = null;
      this.activeSequenceName = null;
      this.activeTimeoutId = null;
      this.activeTimeoutResolve = null;
      this.interruptVersion = 0;
    }

    on(eventName, listener) {
      const listeners = this.listeners.get(eventName) ?? [];
      listeners.push(listener);
      this.listeners.set(eventName, listeners);

      return () => this.off(eventName, listener);
    }

    off(eventName, listener) {
      const listeners = this.listeners.get(eventName);

      if (!listeners) {
        return;
      }

      this.listeners.set(
        eventName,
        listeners.filter((registeredListener) => registeredListener !== listener)
      );
    }

    emit(eventName, payload = {}) {
      const listeners = this.listeners.get(eventName) ?? [];

      listeners.forEach((listener) => {
        listener(payload);
      });
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

    wait(ms, version = this.interruptVersion) {
      if (version !== this.interruptVersion || !this.running) {
        return Promise.resolve(false);
      }

      if (ms <= 0) {
        return Promise.resolve(true);
      }

      return new Promise((resolve) => {
        let settled = false;

        const finalize = (completed) => {
          if (settled) {
            return;
          }

          settled = true;

          if (this.activeTimeoutId === timeoutId) {
            this.activeTimeoutId = null;
            this.activeTimeoutResolve = null;
          }

          resolve(completed);
        };

        const timeoutId = setTimeout(() => {
          const finishedWithoutInterruption = version === this.interruptVersion && this.running;
          finalize(finishedWithoutInterruption);
        }, ms);

        this.activeTimeoutId = timeoutId;
        this.activeTimeoutResolve = () => {
          clearTimeout(timeoutId);
          finalize(false);
        };
      });
    }

    interruptCurrentStep() {
      this.interruptVersion += 1;

      if (typeof this.activeTimeoutResolve === "function") {
        this.activeTimeoutResolve();
      }
    }

    async playFrame(stateName, delay = this.config.frameDelay, version = this.interruptVersion) {
      if (version !== this.interruptVersion || !this.running) {
        return false;
      }

      this.setState(stateName);
      return this.wait(delay, version);
    }

    async playSequence(frames, delay = this.config.frameDelay, version = this.interruptVersion) {
      for (const frame of frames) {
        const completed = await this.playFrame(frame, delay, version);

        if (!completed) {
          return false;
        }
      }

      return true;
    }

    async playDefault(version = this.interruptVersion) {
      return this.playFrame("default", this.config.defaultDelay, version);
    }

    async playTail(version = this.interruptVersion) {
      return this.playSequence(["tail1", "tail2", "tail1"], this.config.frameDelay, version);
    }

    async playStand(version = this.interruptVersion) {
      return this.playSequence(["stand1", "stand2", "stand1", "stand1"], this.config.frameDelay, version);
    }

    async playOpa(version = this.interruptVersion) {
      return this.playSequence(["opa", "default", "opa"], this.config.frameDelay, version);
    }

    async playTongue(version = this.interruptVersion) {
      return this.playFrame("tongue", this.config.tongueDelay, version);
    }

    async playEat(version = this.interruptVersion) {
      return this.playFrame("eat", this.config.eatFrameDelay, version);
    }

    async playChokeSpit(version = this.interruptVersion) {
      return this.playSequence(["choke", "spit"], this.config.frameDelay, version);
    }

    pickNextAutoStep() {
      if (this.nextAutoStepOverride) {
        const forcedStep = this.nextAutoStepOverride;
        this.nextAutoStepOverride = null;
        this.lastAutoStep = forcedStep;
        return forcedStep;
      }

      const nonRepeatedSteps = this.autoSteps.filter((step) => step !== this.lastAutoStep);
      const availableSteps = nonRepeatedSteps.length > 0 ? nonRepeatedSteps : this.autoSteps;
      const randomIndex = Math.floor(Math.random() * availableSteps.length);
      const selectedStep = availableSteps[randomIndex] ?? "default";

      this.lastAutoStep = selectedStep;
      return selectedStep;
    }

    async runAutomaticStep(stepName, version = this.interruptVersion) {
      if (stepName === "tail") {
        return this.playTail(version);
      }

      if (stepName === "opa") {
        return this.playOpa(version);
      }

      if (stepName === "tongue") {
        return this.playTongue(version);
      }

      if (stepName === "stand") {
        return this.playStand(version);
      }

      return this.playDefault(version);
    }

    enqueueManual(sequenceName, options = {}) {
      const { priority = false, interrupt = false } = options;

      if (sequenceName !== "eat" && sequenceName !== "chokeSpit" && sequenceName !== "stand") {
        return;
      }

      if (sequenceName === "eat") {
        const firstNonEatIndex = this.manualQueue.findIndex((queuedSequence) => queuedSequence !== "eat");

        if (firstNonEatIndex === -1) {
          this.manualQueue.push(sequenceName);
        } else {
          this.manualQueue.splice(firstNonEatIndex, 0, sequenceName);
        }

        if (this.activeSequenceName !== "eat") {
          this.interruptCurrentStep();
        }

        return;
      }

      if (priority) {
        this.manualQueue.unshift(sequenceName);
      } else {
        this.manualQueue.push(sequenceName);
      }

      if (interrupt) {
        this.interruptCurrentStep();
      }
    }

    dequeueNextManual() {
      return this.manualQueue.shift();
    }

    async runManualSequence(sequenceName, version = this.interruptVersion) {
      this.emit("manual-sequence-start", { sequenceName });

      let completed = false;

      if (sequenceName === "eat") {
        completed = await this.playEat(version);
      } else if (sequenceName === "stand") {
        completed = await this.playStand(version);
      } else if (sequenceName === "chokeSpit") {
        completed = await this.playChokeSpit(version);
      }

      this.emit("manual-sequence-end", { sequenceName, completed });
      return completed;
    }

    async start() {
      if (this.running || !this.spriteElement) {
        return;
      }

      this.running = true;
      this.preloadAll();
      this.setState("default");

      while (this.running) {
        const manualSequence = this.dequeueNextManual();

        if (manualSequence) {
          const sequenceVersion = this.interruptVersion;
          this.activeSequenceName = manualSequence;
          await this.runManualSequence(manualSequence, sequenceVersion);
          this.activeSequenceName = null;
          continue;
        }

        const autoStep = this.pickNextAutoStep();
        const sequenceVersion = this.interruptVersion;
        this.activeSequenceName = autoStep;
        await this.runAutomaticStep(autoStep, sequenceVersion);
        this.activeSequenceName = null;
      }
    }

    stop() {
      this.running = false;
      this.interruptCurrentStep();
      this.activeSequenceName = null;
      this.setState("default");
    }

    forceNextAutoStep(stepName) {
      if (!this.autoSteps.includes(stepName)) {
        return;
      }

      this.nextAutoStepOverride = stepName;
      this.interruptCurrentStep();
    }

    getStatus() {
      return {
        running: this.running,
        currentState: this.currentState,
        manualQueue: [...this.manualQueue],
        activeSequenceName: this.activeSequenceName,
        nextAutoStep: this.nextAutoStepOverride ?? "random"
      };
    }
  }

  function createDogAnimation(spriteElement) {
    const animator = new DogAnimator(spriteElement, DOG_SPRITES, DOG_ANIMATION_CONFIG, DOG_AUTO_STEPS);

    return {
      animator,
      config: DOG_ANIMATION_CONFIG
    };
  }

  globalThis.DogAnimationModule = {
    createDogAnimation
  };
})();
