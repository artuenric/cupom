(() => {
  function createRewardBurstController({ hostElement, iconPath }) {
    if (!hostElement) {
      throw new Error("Elemento host do reward burst nao encontrado.");
    }

    const layerElement = document.createElement("div");
    layerElement.className = "reward-burst-layer";

    const overlayElement = document.createElement("div");
    overlayElement.className = "reward-burst-overlay";
    overlayElement.setAttribute("aria-hidden", "true");

    const coreElement = document.createElement("div");
    coreElement.className = "reward-burst-core";

    const itemElement = document.createElement("img");
    itemElement.className = "reward-burst-item";
    itemElement.src = iconPath;
    itemElement.alt = "";

    coreElement.appendChild(itemElement);
    overlayElement.appendChild(coreElement);
    layerElement.appendChild(overlayElement);
    hostElement.appendChild(layerElement);

    let dismissCallback = null;

    function restartAnimations() {
      coreElement.style.animation = "none";
      itemElement.style.animation = "none";
      void overlayElement.offsetWidth;
      coreElement.style.animation = "";
      itemElement.style.animation = "";
    }

    function onOverlayPointerDown() {
      if (!isVisible()) {
        return;
      }

      hide();

      if (typeof dismissCallback === "function") {
        dismissCallback();
      }
    }

    function show() {
      restartAnimations();
      overlayElement.classList.remove("is-visible");
      void overlayElement.offsetWidth;
      overlayElement.classList.add("is-visible");
    }

    function hide() {
      overlayElement.classList.remove("is-visible");
    }

    function isVisible() {
      return overlayElement.classList.contains("is-visible");
    }

    function onDismiss(callback) {
      dismissCallback = typeof callback === "function" ? callback : null;
    }

    function destroy() {
      overlayElement.removeEventListener("pointerdown", onOverlayPointerDown);
      layerElement.remove();
      dismissCallback = null;
    }

    overlayElement.addEventListener("pointerdown", onOverlayPointerDown);

    return {
      show,
      hide,
      isVisible,
      onDismiss,
      destroy
    };
  }

  globalThis.RewardBurstModule = {
    createRewardBurstController
  };
})();
