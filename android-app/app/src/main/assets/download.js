(function () {
  const revealItems = Array.from(document.querySelectorAll(".reveal"));

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.16 })
    : null;

  revealItems.forEach((item) => {
    if (observer) {
      observer.observe(item);
    } else {
      item.classList.add("is-visible");
    }
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function drawCover(ctx, video, width, height) {
    const sourceWidth = video.videoWidth || width;
    const sourceHeight = video.videoHeight || height;
    // Scale up by 1.65 to make characters larger and crop empty green screen space
    const scale = Math.max(width / sourceWidth, height / sourceHeight) * 1.65;
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const dx = (width - drawWidth) / 2;
    const dy = (height - drawHeight) / 2;
    ctx.drawImage(video, dx, dy, drawWidth, drawHeight);
  }

  function keyGreenPixels(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      const greenDominance = green - Math.max(red, blue);
      const isGreenScreen = green > 78 && greenDominance > 26 && green > red * 1.18 && green > blue * 1.1;

      if (isGreenScreen) {
        const softness = Math.min(255, Math.max(0, (greenDominance - 18) * 7));
        data[i + 3] = 255 - softness;
      } else if (greenDominance > 10 && green > 70) {
        data[i + 1] = Math.max(0, green - greenDominance * 0.46);
      }
    }
    return imageData;
  }

  function setupChromaStage(container) {
    const canvas = container.querySelector(".character-canvas");
    const video = container.querySelector("video");
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let frameId = 0;
    let failed = false;

    function renderFrame() {
      if (failed) return;

      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) {
        frameId = requestAnimationFrame(renderFrame);
        return;
      }

      try {
        ctx.clearRect(0, 0, width, height);
        drawCover(ctx, video, width, height);
        const keyed = keyGreenPixels(ctx.getImageData(0, 0, width, height));
        ctx.putImageData(keyed, 0, 0);
      } catch (error) {
        failed = true;
        container.classList.add("chroma-failed");
        return;
      }

      frameId = requestAnimationFrame(renderFrame);
    }

    function start() {
      if (failed) return;
      video.play().catch(() => {
        container.classList.add("chroma-failed");
      });
      cancelAnimationFrame(frameId);
      renderFrame();
    }

    video.addEventListener("loadeddata", start, { once: true });
    video.addEventListener("play", start);
    video.addEventListener("error", () => container.classList.add("chroma-failed"));

    if (video.readyState >= 2) start();
  }

  document.querySelectorAll(".character-card.has-video, .character-panel.has-video").forEach(setupChromaStage);

  if (!reduceMotion) {
    const parallaxItems = Array.from(document.querySelectorAll("[data-depth]"));
    window.addEventListener("pointermove", (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      parallaxItems.forEach((item) => {
        const depth = Number(item.dataset.depth || 0);
        item.style.transform = `translate3d(${x * depth * 42}px, ${y * depth * 42}px, 0)`;
      });
    }, { passive: true });
  }

  document.querySelectorAll(".primary-cta, .secondary-cta, .download-chip").forEach((button) => {
    button.addEventListener("pointerdown", () => {
      button.animate([
        { transform: "translateY(0)", boxShadow: "0 6px 0 #050306" },
        { transform: "translateY(4px)", boxShadow: "0 2px 0 #050306" },
        { transform: "translateY(0)", boxShadow: "0 6px 0 #050306" },
      ], {
        duration: 180,
        easing: "ease-out",
      });
    });
  });
}());
