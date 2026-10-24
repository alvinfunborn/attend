(() => {
  const data = JSON.parse(document.getElementById("demo-data").textContent);
  const themeButton = document.getElementById("website-theme");
  themeButton.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    themeButton.setAttribute(
      "aria-label",
      `Switch website to ${next === "dark" ? "light" : "dark"} theme`,
    );
    themeButton.textContent = next === "dark" ? "☼" : "☾";
    document.getElementById("native-console").src =
      next === "dark" ? "./demo/" : "./demo/light.html";
  });
  document.querySelectorAll("[data-gallery-src]").forEach((button) =>
    button.addEventListener("click", () => {
      document.getElementById("gallery-image").src = button.dataset.gallerySrc;
      document.getElementById("gallery-image").alt = button.dataset.galleryTitle;
      document.getElementById("gallery-link").href = button.dataset.gallerySrc;
      document.getElementById("gallery-title").textContent = button.dataset.galleryTitle;
      document.getElementById("gallery-caption").textContent = button.dataset.galleryCaption;
      document
        .querySelectorAll("[data-gallery-src]")
        .forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    }),
  );
  const tabs = [...document.querySelectorAll("[data-workflow]")];
  function selectTab(index, focus = false) {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = i !== index;
    });
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(i));
    tab.addEventListener("keydown", (e) => {
      let index = i;
      if (e.key === "ArrowDown") index = (i + 1) % tabs.length;
      else if (e.key === "ArrowUp") index = (i + tabs.length - 1) % tabs.length;
      else if (e.key === "Home") index = 0;
      else if (e.key === "End") index = tabs.length - 1;
      else return;
      e.preventDefault();
      selectTab(index, true);
    });
  });
  document.querySelectorAll("[data-copy]").forEach((button) =>
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        document.getElementById("copy-status").textContent = data.copied;
      } catch {
        document.getElementById("copy-status").textContent = data.copyFail;
      }
    }),
  );

  const consoleFrame = document.getElementById("native-console");
  document.querySelectorAll("[data-demo-width]").forEach((button) =>
    button.addEventListener("click", () => {
      const width = button.dataset.demoWidth;
      document.querySelector(".native-demo").dataset.workspaceWidth = width;
      document.querySelectorAll("[data-demo-width]").forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      // Reinitialize only the isolated sample so its native layout seeds itself
      // against the chosen width. No real session or user preference is changed.
      consoleFrame.src = consoleFrame.getAttribute("src").split("?")[0];
      document.querySelectorAll("[data-tour]").forEach((item) =>
        item.setAttribute("aria-pressed", String(item.dataset.tour === "overview")),
      );
      document.getElementById("tour-status").textContent = width === "fit"
        ? "The native panel adapts to this screen. Resize its divider or use Settings → Middle panel columns."
        : "3440px workspace: scroll horizontally to explore the full native layout, or open the workspace in a full browser tab.";
    }),
  );
  function showTour(view) {
    consoleFrame.contentWindow.postMessage({ type: "attend-demo-tour", view }, location.origin);
    document
      .querySelectorAll("[data-tour]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.tour === view)),
      );
  }
  document
    .querySelectorAll("[data-tour]")
    .forEach((button) => button.addEventListener("click", () => showTour(button.dataset.tour)));
  document.querySelectorAll("[data-jump-tour]").forEach((link) =>
    link.addEventListener("click", () => {
      if (consoleFrame.getAttribute("loading") === "lazy")
        consoleFrame.setAttribute("loading", "eager");
      const view = link.dataset.jumpTour;
      showTour(view);
      consoleFrame.addEventListener("load", () => showTour(view), { once: true });
    }),
  );
})();
